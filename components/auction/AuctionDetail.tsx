"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import ItemArtwork from "@/components/ItemArtwork";
import NumberInput from "@/components/NumberInput";
import { createClient } from "@/lib/supabase/client";
import { extractBroadcastChange } from "@/lib/supabase/realtime";
import { formatItemLabel } from "@/lib/game/formatItemLabel";
import { formatMoney } from "@/lib/game/priceUtils";

type Bid = {
    id: string;
    bidderName: string;
    amount: number;
    isNPC: boolean;
    playerId: string | null;
    placedAt: string;
};

type Auction = {
    id: string;
    currentBid: number;
    minBid: number;
    buyNow?: number | null;
    endsAt: string;
    status: string;
    listedBy: string;
    hostName?: string | null;
    hostIsNPC?: boolean;
    leadingPlayerId?: string | null;
    winningPlayerId?: string | null;
    item: {
        name: string;
        description?: string | null;
        category: string;
    };
    bids?: Bid[];
};

function useCountdown(endsAt: string) {
    const [timeLeft, setTimeLeft] = useState("");
    const [ended, setEnded] = useState(false);

    useEffect(() => {
        function update() {
            const diff = new Date(endsAt).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft("Ended");
                setEnded(true);
                return;
            }
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
        }
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [endsAt]);

    return { timeLeft, ended };
}

const supabase = createClient();

export default function AuctionDetail({
    auction,
    playerWallet,
    isOwnListing,
    currentPlayerId,
    currentPlayerName,
    onClose,
    onWalletUpdate,
}: {
    auction: Auction;
    playerWallet: number;
    isOwnListing: boolean;
    currentPlayerId?: string;
    currentPlayerName?: string;
    onClose?: () => void;
    onWalletUpdate?: (wallet: number) => void;
}) {
    const maxMainStyle = onClose ? { maxHeight: "calc(100vh - 4rem)" } : undefined;
    const [currentBid, setCurrentBid] = useState(auction.currentBid);
    const [leadingPlayerId, setLeadingPlayerId] = useState<string | null>(auction.leadingPlayerId ?? null);
    const [auctionStatus, setAuctionStatus] = useState(auction.status);
    const [buyNow] = useState<number | null | undefined>(auction.buyNow);
    const [bids, setBids] = useState<Bid[]>(auction.bids ?? []);
    const [hasLoadedBidHistory, setHasLoadedBidHistory] = useState(Array.isArray(auction.bids));
    const [historyLoading, setHistoryLoading] = useState(false);
    const [bidAmount, setBidAmount] = useState("");
    const [wallet, setWallet] = useState(playerWallet);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [buyNowLoading, setBuyNowLoading] = useState(false);
    const [isDiving, setIsDiving] = useState(false);
    const { timeLeft, ended } = useCountdown(auction.endsAt);
    const router = useRouter();
    const currentBidRef = useRef(auction.currentBid);
    const leadingPlayerIdRef = useRef<string | null>(auction.leadingPlayerId ?? null);
    const auctionStatusRef = useRef(auction.status);
    const buyoutToastShownRef = useRef(false);

    const isLeading = currentPlayerId && leadingPlayerId === currentPlayerId;
    const isAuctionClosed = ended || auctionStatus !== "active";

    const applyAuctionSnapshot = useCallback(
        (next: { currentBid?: number; leadingPlayerId?: string | null; status?: string; winningPlayerId?: string | null }) => {
            const previousLeadingPlayerId = leadingPlayerIdRef.current;
            const previousStatus = auctionStatusRef.current;
            const hasLeadingPlayer = Object.prototype.hasOwnProperty.call(next, "leadingPlayerId");
            const nextLeadingPlayerId = hasLeadingPlayer ? (next.leadingPlayerId ?? null) : previousLeadingPlayerId;
            const nextStatus = typeof next.status === "string" ? next.status : previousStatus;

            if (typeof next.currentBid === "number") {
                currentBidRef.current = next.currentBid;
                setCurrentBid(next.currentBid);
            }

            if (hasLeadingPlayer) {
                leadingPlayerIdRef.current = nextLeadingPlayerId;
                setLeadingPlayerId(nextLeadingPlayerId);
            }

            if (typeof next.status === "string") {
                auctionStatusRef.current = next.status;
                setAuctionStatus(next.status);
            }

            const playerWasLeading = Boolean(currentPlayerId && previousLeadingPlayerId === currentPlayerId);
            const lostToBuyNow = playerWasLeading && previousStatus === "active" && nextStatus !== "active" && nextLeadingPlayerId !== currentPlayerId;

            if (lostToBuyNow && !buyoutToastShownRef.current) {
                buyoutToastShownRef.current = true;
                const finalPrice = typeof next.currentBid === "number" ? next.currentBid : (buyNow ?? currentBidRef.current);
                toast.error(`Another bidder bought out ${auction.item.name} for $${formatMoney(finalPrice)} while you were leading.`);
            }

            if (currentPlayerId && nextStatus === "active" && nextLeadingPlayerId === currentPlayerId) {
                buyoutToastShownRef.current = false;
            }
        },
        [auction.item.name, buyNow, currentPlayerId],
    );

    useEffect(() => {
        setWallet(playerWallet);
    }, [playerWallet]);

    useEffect(() => {
        if (hasLoadedBidHistory) return;

        let mounted = true;
        const timeoutId = window.setTimeout(async () => {
            setHistoryLoading(true);

            try {
                const res = await fetch(`/api/auctions/${auction.id}?includeBids=1`);
                if (!res.ok || !mounted) return;

                const data = await res.json();
                if (!data.auction || !mounted || !Array.isArray(data.auction.bids)) return;

                setBids(data.auction.bids);
                setHasLoadedBidHistory(true);
            } catch {
                // ignore
            } finally {
                if (mounted) {
                    setHistoryLoading(false);
                }
            }
        }, 250);

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
        };
    }, [auction.id, hasLoadedBidHistory]);

    // Re-fetch auction (bids + current state) as a polling fallback
    // in case Supabase Realtime on the Bid table is not enabled
    useEffect(() => {
        let mounted = true;
        async function pollAuction() {
            try {
                const res = await fetch(`/api/auctions/${auction.id}`);
                if (!res.ok || !mounted) return;
                const data = await res.json();
                if (!data.auction) return;
                const a = data.auction;
                applyAuctionSnapshot({
                    currentBid: a.currentBid,
                    leadingPlayerId: a.leadingPlayerId ?? null,
                    status: a.status,
                    winningPlayerId: a.winningPlayerId ?? null,
                });
                if (Array.isArray(a.bids)) {
                    setBids(a.bids);
                    setHasLoadedBidHistory(true);
                }
            } catch {
                // ignore
            }
        }
        const interval = setInterval(pollAuction, 10000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [applyAuctionSnapshot, auction.id]);

    // Realtime subscription
    useEffect(() => {
        let channel: ReturnType<(typeof supabase)["channel"]> | null = null;

        const subscribe = async () => {
            await supabase.realtime.setAuth();

            channel = supabase
                .channel(`auction-detail:${auction.id}`, { config: { private: true } })
                .on("broadcast", { event: "INSERT" }, (payload) => {
                    const { record } = extractBroadcastChange(payload);
                    const newBid = record as {
                        id?: string;
                        bidderName: string;
                        amount: number;
                        isNPC: boolean;
                        playerId: string | null;
                        placedAt: string;
                    };

                    if (!newBid.id || typeof newBid.amount !== "number") return;
                    setBids((prev) => {
                        // If we already have this bid, skip adding to avoid duplicates
                        if (prev.some((b) => b.id === newBid.id)) return prev;
                        // Remove any optimistic placeholders before prepending the real bid
                        const cleaned = prev.filter((b) => !b.id.startsWith("optimistic-"));
                        return [newBid as typeof newBid & { id: string }, ...cleaned];
                    });
                    applyAuctionSnapshot({ currentBid: newBid.amount, leadingPlayerId: newBid.playerId ?? null });
                })
                .on("broadcast", { event: "UPDATE" }, (payload) => {
                    const { record } = extractBroadcastChange(payload);
                    const updated = record as { currentBid?: number; leadingPlayerId?: string | null; status?: string; winningPlayerId?: string | null };

                    applyAuctionSnapshot(updated);
                })
                .subscribe();
        };

        subscribe();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [applyAuctionSnapshot, auction.id]);

    useEffect(() => {
        if (!currentPlayerId) return;

        let channel: ReturnType<(typeof supabase)["channel"]> | null = null;
        let cancelled = false;

        const subscribe = async () => {
            await supabase.realtime.setAuth();
            if (cancelled) return;

            const {
                data: { user },
            } = await supabase.auth.getUser();

            const uid = user?.id;
            if (cancelled || !uid || uid !== currentPlayerId) return;

            channel = supabase
                .channel(`player-wallet:${uid}`, { config: { private: true } })
                .on("broadcast", { event: "UPDATE" }, (payload) => {
                    const { record: updated } = extractBroadcastChange(payload);
                    const ownerId = (updated["id"] ?? updated["player_id"] ?? updated["playerId"] ?? updated["user_id"] ?? updated["userId"]) as string | null;

                    if (ownerId && ownerId !== uid) return;

                    const updatedWallet = updated["wallet"];
                    if (typeof updatedWallet === "number") {
                        setWallet(updatedWallet);
                        onWalletUpdate?.(updatedWallet);
                    }
                })
                .subscribe();
        };

        subscribe();

        return () => {
            cancelled = true;
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [currentPlayerId, onWalletUpdate]);

    const minNextBid = currentBid + 1;

    async function handleBid() {
        setError(null);
        const amount = parseFloat(bidAmount);

        if (isNaN(amount) || amount < minNextBid) {
            setError(`Minimum bid is $${formatMoney(minNextBid)}`);
            return;
        }
        if (amount > wallet) {
            setError(`Not enough funds`);
            return;
        }

        setLoading(true);
        const optimisticId = `optimistic-${Date.now()}`;

        // Add optimistic placeholder immediately so UI feels responsive
        setBids((prev) => [
            {
                id: optimisticId,
                bidderName: currentPlayerName ?? "You",
                amount: Math.max(minNextBid, parseFloat(bidAmount) || minNextBid),
                isNPC: false,
                playerId: currentPlayerId ?? null,
                placedAt: new Date().toISOString(),
            },
            ...prev.filter((b) => !b.id.startsWith("optimistic-")),
        ]);

        try {
            const res = await fetch(`/api/auctions/${auction.id}/bid`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            });
            const data = await res.json();

            if (!data.ok) {
                setError(data.error);
                // remove optimistic placeholder on failure
                setBids((prev) => prev.filter((b) => !b.id.startsWith("optimistic-")));
                setLoading(false);
                return;
            }

            const serverBid = data.bid;

            setCurrentBid(data.currentBid);
            setLeadingPlayerId(currentPlayerId ?? null);
            setWallet(data.wallet);
            onWalletUpdate?.(data.wallet);

            // Replace/remove optimistic placeholder and ensure the real bid is present
            setBids((prev) => {
                // If the server bid is already present (e.g. realtime INSERT arrived earlier),
                // just remove optimistic placeholders.
                if (prev.some((b) => b.id === serverBid.id)) {
                    return prev.filter((b) => !b.id.startsWith("optimistic-"));
                }

                // Otherwise prepend the server bid and remove optimistic placeholders.
                return [
                    {
                        ...serverBid,
                        placedAt: typeof serverBid.placedAt === "string" ? serverBid.placedAt : new Date().toISOString(),
                    },
                    ...prev.filter((b) => !b.id.startsWith("optimistic-")),
                ];
            });

            setBidAmount("");
            toast.success(`Bid placed: $${formatMoney(data.currentBid)}`);
        } finally {
            setLoading(false);
        }
    }

    async function handleBuyNow() {
        setError(null);
        setBuyNowLoading(true);
        const res = await fetch(`/api/auctions/${auction.id}/buy-now`, { method: "POST" });
        const data = await res.json();

        if (!data.ok) {
            setError(data.error);
            setBuyNowLoading(false);
            return;
        }

        setWallet(data.wallet);
        onWalletUpdate?.(data.wallet);
        toast.success(`🎉 You bought ${auction.item.name} for $${formatMoney(buyNow ?? 0)}!`);
        setBuyNowLoading(false);
        onClose?.();
        router.refresh();
    }

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch("/api/player/dive-status");
                const data = await res.json();
                if (!mounted) return;
                setIsDiving(Boolean(data?.isDiving));
            } catch {
                // ignore
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const hostLabel = auction.hostName ?? (auction.hostIsNPC ? "NPC" : "Unknown");

    return (
        <main className={(onClose ? "p-4 sm:p-6" : "min-h-screen p-4 sm:p-8 max-w-2xl mx-auto") + " no-visible-scrollbar"} style={maxMainStyle}>
            {onClose ? (
                <button onClick={onClose} className="text-sm text-gray-500 hover:underline">
                    ← Back to auctions
                </button>
            ) : (
                <Link href="/auctions" className="text-sm text-gray-500 hover:underline">
                    ← Back to auctions
                </Link>
            )}

            <div className="mt-6 rounded-2xl border border-stone-700/80 bg-stone-950/80 p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                        <ItemArtwork itemName={auction.item.name} priority className="rounded-3xl w-20 h-20 sm:w-32 sm:h-32" />
                        <div>
                            <h1 className="text-2xl font-bold">{auction.item.name}</h1>
                            <p className="mt-1 text-sm text-stone-400 capitalize">{formatItemLabel(auction.item)}</p>
                            <p className="mt-3 text-xs text-stone-400">
                                Hosted by <span className={auction.hostIsNPC ? "text-yellow-400 font-medium" : "text-stone-300"}>{hostLabel}</span>
                                {auction.hostIsNPC && <span className="ml-1 text-yellow-500 text-[10px] uppercase tracking-wide font-semibold">NPC</span>}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-stone-500">Time left</p>
                        <p className={`font-mono text-xl font-bold ${ended ? "text-red-500" : ""}`}>{timeLeft}</p>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
                    <div>
                        <p className="text-xs text-stone-500">Current bid</p>
                        <p className="text-3xl font-bold text-stone-50">${formatMoney(currentBid)}</p>
                        {isLeading && <p className="text-xs text-green-400 font-medium mt-0.5">You are leading!</p>}
                    </div>
                    {buyNow != null && (
                        <div className="text-center">
                            <p className="text-xs text-stone-500">Buy Now price</p>
                            <p className="text-2xl font-bold text-emerald-400">${formatMoney(buyNow ?? 0)}</p>
                        </div>
                    )}
                    <div className="text-right">
                        <p className="text-xs text-stone-500">Your wallet</p>
                        <p className="text-xl font-semibold text-stone-100">${formatMoney(wallet)}</p>
                    </div>
                </div>

                {!isAuctionClosed && !isOwnListing && (
                    <div className="mt-6 space-y-2">
                        <div className="flex">
                            <NumberInput
                                value={bidAmount}
                                onChange={setBidAmount}
                                min={minNextBid}
                                step={1}
                                className="min-w-0 flex-1 border-l-4 border-stone-50"
                                inputClassName="rounded border border-stone-700 bg-stone-900 p-1 sm:p-2 text-sm sm:text-base"
                                placeholder={`Min $${formatMoney(minNextBid)}`}
                            />
                            {isDiving && <p className="text-sm text-yellow-600 self-center">You cannot bid while dumpster-diving.</p>}
                        </div>

                        <div className="flex gap-4">
                            {buyNow != null && buyNow > currentBid && (
                                <button
                                    onClick={handleBuyNow}
                                    disabled={buyNowLoading || isDiving || wallet < buyNow}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded font-semibold disabled:opacity-50 transition-colors"
                                >
                                    {buyNowLoading ? "Processing..." : `Buy Now — $${formatMoney(buyNow ?? 0)}`}
                                </button>
                            )}
                            <button
                                onClick={handleBid}
                                disabled={loading || isDiving}
                                className="w-full rounded bg-slate-700 px-6 py-2 text-white disabled:opacity-50"
                            >
                                {loading ? "Bidding..." : "Bid"}
                            </button>
                        </div>
                    </div>
                )}

                {!isAuctionClosed && isOwnListing && <p className="mt-6 text-sm text-gray-500 italic">This is your listing — you cannot bid or buy it.</p>}

                {auctionStatus !== "active" && <p className="mt-6 text-sm text-amber-400">This auction is no longer active.</p>}

                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            <div className="mt-6">
                <h2 className="font-semibold mb-3">Bid History</h2>
                {historyLoading && bids.length === 0 ? (
                    <p className="text-gray-500 text-sm">Loading bid history…</p>
                ) : bids.length === 0 ? (
                    <p className="text-gray-500 text-sm">No bids yet. Be the first!</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {bids.map((bid) => {
                            const isYou = !bid.isNPC && currentPlayerId && bid.playerId === currentPlayerId;
                            return (
                                <div key={bid.id} className="flex justify-between text-sm border-b pb-2">
                                    <span className="font-medium">
                                        {bid.bidderName}
                                        {isYou && <span className="ml-1 text-blue-600 font-semibold">(You)</span>}
                                        {bid.isNPC && <span className="ml-1 text-yellow-500 text-xs">[NPC]</span>}
                                    </span>
                                    <span>${formatMoney(bid.amount)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}

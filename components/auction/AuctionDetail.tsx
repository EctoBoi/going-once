"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import ItemArtwork from "@/components/ItemArtwork";
import { createClient } from "@/lib/supabase/client";
import { extractBroadcastChange } from "@/lib/supabase/realtime";
import MarketEvaluator from "@/components/MarketEvaluator";
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
    item: {
        name: string;
        description?: string | null;
        category: string;
    };
    bids: Bid[];
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
    const [currentBid, setCurrentBid] = useState(auction.currentBid);
    const [leadingPlayerId, setLeadingPlayerId] = useState<string | null>(auction.leadingPlayerId ?? null);
    const [buyNow] = useState<number | null | undefined>(auction.buyNow);
    const [bids, setBids] = useState(auction.bids);
    const [bidAmount, setBidAmount] = useState("");
    const [wallet, setWallet] = useState(playerWallet);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [buyNowLoading, setBuyNowLoading] = useState(false);
    const [isDiving, setIsDiving] = useState(false);
    const { timeLeft, ended } = useCountdown(auction.endsAt);
    const router = useRouter();

    const isLeading = currentPlayerId && leadingPlayerId === currentPlayerId;

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
                setCurrentBid(a.currentBid);
                setLeadingPlayerId(a.leadingPlayerId ?? null);
                setBids(a.bids ?? []);
            } catch {
                // ignore
            }
        }
        const interval = setInterval(pollAuction, 10000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [auction.id]);

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
                    setCurrentBid(newBid.amount);
                    setLeadingPlayerId(newBid.playerId);
                })
                .on("broadcast", { event: "UPDATE" }, (payload) => {
                    const { record } = extractBroadcastChange(payload);
                    const updated = record as { currentBid?: number; leadingPlayerId?: string | null; status?: string };

                    if (updated.currentBid === undefined) return;
                    setCurrentBid(updated.currentBid);
                    setLeadingPlayerId(updated.leadingPlayerId ?? null);
                })
                .subscribe();
        };

        subscribe();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [auction.id, auction.item.name, currentPlayerId, isLeading]);

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
        const res = await fetch(`/api/auctions/${auction.id}/bid`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
        });
        const data = await res.json();

        if (!data.ok) {
            setError(data.error);
            setLoading(false);
            return;
        }

        setCurrentBid(data.currentBid);
        setLeadingPlayerId(currentPlayerId ?? null);
        setWallet(data.wallet);
        onWalletUpdate?.(data.wallet);
        // Optimistically add bid to history
        setBids((prev) => [
            {
                id: `optimistic-${Date.now()}`,
                bidderName: currentPlayerName ?? "You",
                amount: data.currentBid,
                isNPC: false,
                playerId: currentPlayerId ?? null,
                placedAt: new Date().toISOString(),
            },
            ...prev.filter((b) => !b.id.startsWith("optimistic-")),
        ]);
        setBidAmount("");
        toast.success(`Bid placed: $${formatMoney(data.currentBid)}`);
        setLoading(false);
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
        <main className={onClose ? "p-4 sm:p-6" : "min-h-screen p-4 sm:p-8 max-w-2xl mx-auto"}>
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
                            <p className="mt-3 text-sm leading-6 text-stone-300">{auction.item.description}</p>
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

                {!ended && !isOwnListing && (
                    <div className="mt-6 space-y-2">
                        <div className="flex">
                            <input
                                type="number"
                                placeholder={`Min $${formatMoney(minNextBid)}`}
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                                className="min-w-0 w-24 sm:flex-1 rounded border border-stone-700 bg-stone-900 p-1 sm:p-2 text-sm sm:text-base"
                                min={minNextBid}
                                step={1}
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
                                className="w-full rounded bg-neutral-950 px-6 py-2 text-white disabled:opacity-50"
                            >
                                {loading ? "Bidding..." : "Bid"}
                            </button>
                        </div>
                    </div>
                )}

                {!ended && isOwnListing && <p className="mt-6 text-sm text-gray-500 italic">This is your listing — you cannot bid or buy it.</p>}

                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            <div className="mt-6">
                <h2 className="font-semibold mb-3">Bid History</h2>
                {bids.length === 0 ? (
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
            <MarketEvaluator />
        </main>
    );
}

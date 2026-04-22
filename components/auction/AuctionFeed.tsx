"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { extractBroadcastChange } from "@/lib/supabase/realtime";
import AuctionCard from "./AuctionCard";
import { formatMoney } from "@/lib/game/priceUtils";

type Auction = {
    id: string;
    currentBid: number;
    minBid: number;
    buyNow?: number | null;
    endsAt: string | Date;
    status: string;
    listedBy: string;
    hostName?: string | null;
    hostIsNPC?: boolean;
    leadingPlayerId?: string | null;
    winningPlayerId?: string | null;
    bidCount: number;
    item: {
        id: string;
        name: string;
        description?: string | null;
        category: string;
    };
};

const supabase = createClient();

export default function AuctionFeed({
    initialAuctions,
    currentPlayerId,
    onOpenAuction,
    onToggleSidebar,
}: {
    initialAuctions: Auction[];
    currentPlayerId?: string;
    onOpenAuction?: (id: string) => void;
    onToggleSidebar?: () => void;
}) {
    const [auctions, setAuctions] = useState(initialAuctions);
    const [refreshing, setRefreshing] = useState(false);
    const [hideOwnListings, setHideOwnListings] = useState(false);
    // Track auctions the player previously led (to detect outbid events)
    const playerLedRef = useRef<Set<string>>(new Set(initialAuctions.filter((a) => a.leadingPlayerId === currentPlayerId).map((a) => a.id)));

    const fetchAuctions = useCallback(async () => {
        const res = await fetch("/api/auctions/list");
        if (res.ok) {
            const data = await res.json();
            setAuctions(data.auctions);
            // Rebuild the leading set after refresh
            if (currentPlayerId) {
                playerLedRef.current = new Set((data.auctions as Auction[]).filter((a) => a.leadingPlayerId === currentPlayerId).map((a) => a.id));
            }
        }
    }, [currentPlayerId]);

    // Persist user's preference for hiding their own listings
    useEffect(() => {
        try {
            const v = localStorage.getItem("hideOwnListings");
            if (v === "1") setHideOwnListings(true);
        } catch (e) {
            console.error("Failed to load hideOwnListings preference", e);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("hideOwnListings", hideOwnListings ? "1" : "0");
        } catch (e) {
            console.error("Failed to persist hideOwnListings preference", e);
        }
    }, [hideOwnListings]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await fetchAuctions();
        } finally {
            setRefreshing(false);
        }
    }

    // Realtime subscription for the auctions table
    useEffect(() => {
        let channel: ReturnType<(typeof supabase)["channel"]> | null = null;

        const subscribe = async () => {
            await supabase.realtime.setAuth();

            channel = supabase
                .channel("public:Auction:feed", { config: { private: true } })
                .on("broadcast", { event: "INSERT" }, () => {
                    // Re-fetch so we get the full auction with item relation.
                    fetchAuctions();
                })
                .on("broadcast", { event: "UPDATE" }, (payload) => {
                    const { record } = extractBroadcastChange(payload);
                    const updated = record as Partial<Auction> & { id?: string; endsAt?: string };

                    if (!updated.id) {
                        fetchAuctions();
                        return;
                    }

                    const auctionId = updated.id;

                    if (updated.status && updated.status !== "active") {
                        const pendingToasts: Array<() => void> = [];
                        const hasLeadingPlayer = Object.prototype.hasOwnProperty.call(updated, "leadingPlayerId");

                        setAuctions((prev) => {
                            const existing = prev.find((a) => a.id === auctionId);
                            const playerWasLeading = Boolean(currentPlayerId && playerLedRef.current.has(auctionId));

                            if (existing && playerWasLeading && hasLeadingPlayer && updated.leadingPlayerId !== currentPlayerId) {
                                const finalPrice = typeof updated.currentBid === "number" ? updated.currentBid : existing.currentBid;
                                pendingToasts.push(() =>
                                    toast.error(`Another bidder bought out ${existing.item.name} for $${formatMoney(finalPrice)} while you were leading.`),
                                );
                            }

                            return prev.filter((a) => a.id !== auctionId);
                        });

                        playerLedRef.current.delete(auctionId);
                        outbidAuctions.current.delete(auctionId);
                        outbidToastTimesRef.current.delete(auctionId);
                        pendingToasts.forEach((fn) => fn());
                        return;
                    }

                    const hasCurrentBid = typeof updated.currentBid === "number";
                    const hasBidCount = typeof updated.bidCount === "number";
                    const hasLeadingPlayer = Object.prototype.hasOwnProperty.call(updated, "leadingPlayerId");
                    // If update has neither currentBid nor bidCount, fall back to full fetch
                    if (!hasCurrentBid && !hasBidCount && !hasLeadingPlayer) {
                        fetchAuctions();
                        return;
                    }

                    const pendingToasts: Array<() => void> = [];

                    // Deduplicate outbid toasts per-auction (3s window)
                    const recentOutbidToastTimes = outbidToastTimesRef.current;

                    setAuctions((prev) =>
                        prev.map((a) => {
                            if (a.id !== updated.id) return a;

                            if (currentPlayerId && playerLedRef.current.has(a.id) && updated.leadingPlayerId !== currentPlayerId) {
                                // Mark outbid for UI and enqueue a user-visible toast (deduped)
                                outbidAuctions.current.add(a.id);
                                playerLedRef.current.delete(a.id);

                                const now = Date.now();
                                const last = recentOutbidToastTimes.get(a.id) || 0;
                                if (now - last > 3000) {
                                    recentOutbidToastTimes.set(a.id, now);
                                    const name = a.item?.name ?? "item";
                                    const newBidAmount = hasCurrentBid ? (updated.currentBid as number) : a.currentBid;
                                    pendingToasts.push(() => toast.error(`You were outbid on a ${name}! New bid: $${formatMoney(newBidAmount)}`));
                                }
                            }

                            if (currentPlayerId && updated.leadingPlayerId === currentPlayerId) {
                                playerLedRef.current.add(a.id);
                            }

                            // Determine new bid count: prefer explicit bidCount, otherwise infer increment if currentBid increased
                            const newBidCount = hasBidCount
                                ? (updated.bidCount as number)
                                : hasCurrentBid && updated.currentBid! > a.currentBid
                                  ? a.bidCount + 1
                                  : a.bidCount;

                            return {
                                ...a,
                                currentBid: hasCurrentBid ? (updated.currentBid as number) : a.currentBid,
                                bidCount: newBidCount,
                                leadingPlayerId: hasLeadingPlayer ? (updated.leadingPlayerId ?? null) : a.leadingPlayerId,
                            };
                        }),
                    );

                    // Run toasts after state update to avoid triggering React state updates during render
                    pendingToasts.forEach((fn) => fn());
                })
                .on("broadcast", { event: "DELETE" }, (payload) => {
                    const { oldRecord } = extractBroadcastChange(payload);
                    const id = oldRecord.id as string | undefined;
                    if (!id) return;
                    setAuctions((prev) => prev.filter((a) => a.id !== id));
                })
                .subscribe();
        };

        subscribe();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [currentPlayerId, fetchAuctions]);

    // Track which auctions the player has been outbid on (for border styling)
    const outbidAuctions = useRef<Set<string>>(new Set());

    // Track recent outbid toast timestamps to avoid spamming the user
    const outbidToastTimesRef = useRef<Map<string, number>>(new Map());

    function isOutbid(auction: Auction): boolean {
        return outbidAuctions.current.has(auction.id);
    }

    function handleBuyNow(auctionId: string) {
        onOpenAuction?.(auctionId);
    }

    const displayedAuctions = auctions.filter((a) => {
        if (!hideOwnListings || !currentPlayerId) return true;
        return a.listedBy !== currentPlayerId;
    });

    return (
        <div>
            <div className="flex items-center mb-4">
                <button
                    type="button"
                    onClick={() => onToggleSidebar?.()}
                    className="lg:hidden mr-3 bg-gray-800 text-white rounded p-2"
                    aria-label="Open sidebar"
                >
                    ☰
                </button>

                <div className="ml-auto flex items-center space-x-3">
                    <label className="text-sm flex items-center space-x-2">
                        <input type="checkbox" checked={hideOwnListings} onChange={(e) => setHideOwnListings(e.target.checked)} className="w-4 h-4" />
                        <span className="select-none">Hide my listings</span>
                    </label>
                    <button onClick={handleRefresh} disabled={refreshing} className="text-sm border px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50">
                        {refreshing ? "Refreshing…" : "↻ Refresh"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {displayedAuctions.length === 0 && <p className="text-gray-500">Gathering active auctions, one moment please...</p>}
                {displayedAuctions.map((auction) => (
                    <AuctionCard
                        key={auction.id}
                        auction={auction}
                        currentPlayerId={currentPlayerId}
                        outbid={isOutbid(auction)}
                        onOpen={onOpenAuction ? () => onOpenAuction(auction.id) : undefined}
                        onBuyNow={handleBuyNow}
                    />
                ))}
            </div>
        </div>
    );
}

"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import AuctionCard from "./AuctionCard";
import MarketEvaluator from "@/components/MarketEvaluator";

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
    bidCount: number;
    item: {
        id: string;
        name: string;
        category: string;
    };
};

const supabase = createClient();

export default function AuctionFeed({
    initialAuctions,
    currentPlayerId,
    onOpenAuction,
}: {
    initialAuctions: Auction[];
    currentPlayerId?: string;
    onOpenAuction?: (id: string) => void;
}) {
    const [auctions, setAuctions] = useState(initialAuctions);
    const [refreshing, setRefreshing] = useState(false);
    // Track auctions the player previously led (to detect outbid events)
    const playerLedRef = useRef<Set<string>>(new Set(initialAuctions.filter((a) => a.leadingPlayerId === currentPlayerId).map((a) => a.id)));

    async function fetchAuctions() {
        const res = await fetch("/api/auctions/list");
        if (res.ok) {
            const data = await res.json();
            setAuctions(data.auctions);
            // Rebuild the leading set after refresh
            if (currentPlayerId) {
                playerLedRef.current = new Set((data.auctions as Auction[]).filter((a) => a.leadingPlayerId === currentPlayerId).map((a) => a.id));
            }
        }
    }

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
        const channel = supabase
            .channel("public:Auction:feed")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "Auction" }, () => {
                // Re-fetch so we get the full auction with item relation
                fetchAuctions();
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "Auction" }, (payload) => {
                const updated = payload.new as Auction & { endsAt: string };

                setAuctions((prev) =>
                    prev.map((a) => {
                        if (a.id !== updated.id) return a;

                        // Detect outbid: player was leading and no longer is
                        if (currentPlayerId && playerLedRef.current.has(a.id) && updated.leadingPlayerId !== currentPlayerId) {
                            toast.error(`You were outbid on ${a.item.name}! New bid: $${updated.currentBid.toFixed(2)}`);
                            playerLedRef.current.delete(a.id);
                        }

                        // Detect player now leading
                        if (currentPlayerId && updated.leadingPlayerId === currentPlayerId) {
                            playerLedRef.current.add(a.id);
                        }

                        // Detect player's listing sold (auction resolved with a winner)
                        if (currentPlayerId && a.listedBy === currentPlayerId && updated.status === "resolved" && a.status !== "resolved") {
                            toast.success(`Your listing "${a.item.name}" sold for $${updated.currentBid.toFixed(2)}!`);
                        }

                        // Detect player won an auction
                        if (currentPlayerId && updated.status === "resolved" && a.status !== "resolved" && updated.leadingPlayerId === currentPlayerId) {
                            toast.success(`🎉 You won "${a.item.name}" for $${updated.currentBid.toFixed(2)}!`);
                        }

                        return { ...a, ...updated };
                    }),
                );
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "Auction" }, (payload) => {
                const id = (payload.old as { id: string }).id;
                setAuctions((prev) => prev.filter((a) => a.id !== id));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentPlayerId]);

    // Track which auctions the player has been outbid on (for border styling)
    const outbidAuctions = useRef<Set<string>>(new Set());

    function isOutbid(auction: Auction): boolean {
        return outbidAuctions.current.has(auction.id);
    }

    function handleBuyNow(auctionId: string) {
        onOpenAuction?.(auctionId);
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                <button onClick={handleRefresh} disabled={refreshing} className="text-sm border px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50">
                    {refreshing ? "Refreshing…" : "↻ Refresh"}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {auctions.length === 0 && <p className="text-gray-500">No active auctions. Check back soon.</p>}
                {auctions.map((auction) => (
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
            <MarketEvaluator />
        </div>
    );
}

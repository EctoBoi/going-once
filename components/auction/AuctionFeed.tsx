"use client";

import { useState } from "react";
import AuctionCard from "./AuctionCard";
import MarketEvaluator from "@/components/MarketEvaluator";

type Auction = {
    id: string;
    currentBid: number;
    minBid: number;
    endsAt: string | Date;
    status: string;
    listedBy: string;
    bidCount: number;
    item: {
        id: string;
        name: string;
        category: string;
    };
};

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

    async function handleRefresh() {
        setRefreshing(true);
        try {
            const res = await fetch("/api/auctions/list");
            if (res.ok) {
                const data = await res.json();
                setAuctions(data.auctions);
            }
        } finally {
            setRefreshing(false);
        }
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
                        onOpen={onOpenAuction ? () => onOpenAuction(auction.id) : undefined}
                    />
                ))}
            </div>
            <MarketEvaluator />
        </div>
    );
}

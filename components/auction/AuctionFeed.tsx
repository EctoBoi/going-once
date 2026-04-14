"use client";

import { useEffect, useState } from "react";
import AuctionCard from "./AuctionCard";

type Auction = {
    id: string;
    currentBid: number;
    minBid: number;
    endsAt: string | Date;
    status: string;
    item: {
        id: string;
        name: string;
        category: string;
    };
};

export default function AuctionFeed({ initialAuctions }: { initialAuctions: Auction[] }) {
    const [auctions, setAuctions] = useState(initialAuctions);

    useEffect(() => {
        // Run NPC evaluation every 15 seconds
        const interval = setInterval(() => {
            fetch("/api/npc/evaluate", { method: "POST" });
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auctions.length === 0 && <p className="text-gray-500">No active auctions. Check back soon.</p>}
            {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
            ))}
        </div>
    );
}

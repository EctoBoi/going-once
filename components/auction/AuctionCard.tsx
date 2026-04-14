"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

function useCountdown(endsAt: string | Date) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        function update() {
            const diff = new Date(endsAt).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft("Ended");
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

    return timeLeft;
}

export default function AuctionCard({ auction }: { auction: Auction }) {
    const timeLeft = useCountdown(auction.endsAt);

    return (
        <Link href={`/auctions/${auction.id}`}>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="font-semibold">{auction.item.name}</h2>
                    <span className="text-xs text-gray-500 capitalize">{auction.item.category}</span>
                </div>
                <div className="flex justify-between items-center mt-4">
                    <div>
                        <p className="text-xs text-gray-500">Current bid</p>
                        <p className="font-bold">${auction.currentBid.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Time left</p>
                        <p className={`font-mono font-bold ${timeLeft === "Ended" ? "text-red-500" : ""}`}>{timeLeft}</p>
                    </div>
                </div>
            </div>
        </Link>
    );
}

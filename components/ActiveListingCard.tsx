"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatItemLabel } from "@/lib/game/formatItemLabel";

type Bid = {
    id: string;
    bidderName: string;
    amount: number;
    isNPC: boolean;
    placedAt: string;
};

type Auction = {
    id: string;
    currentBid: number;
    endsAt: string;
    bids: Bid[];
};

type PlayerItem = {
    id: string;
    acquiredFor: number;
    item: {
        name: string;
        description?: string | null;
        category: string;
    };
};

function useCountdown(endsAt: string) {
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

export default function ActiveListingCard({
    playerItem,
    auction,
    onOpen,
}: {
    playerItem: PlayerItem;
    auction: Auction | null;
    onOpen?: (auctionId: string) => void;
}) {
    const timeLeft = useCountdown(auction?.endsAt ?? "");

    if (!auction) return null;

    const cls = "border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer";

    if (onOpen) {
        return (
            <div onClick={() => onOpen(auction.id)} className={cls}>
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="font-medium">{playerItem.item.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{formatItemLabel(playerItem.item)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            {playerItem.acquiredFor === 0 ? "Found in trash" : `Paid $${playerItem.acquiredFor.toFixed(2)}`}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Time left</p>
                        <p className="font-mono font-bold text-sm">{timeLeft}</p>
                    </div>
                </div>

                <div className="flex justify-between mb-3">
                    <div>
                        <p className="text-xs text-gray-500">Current bid</p>
                        <p className="font-bold">${auction.currentBid.toFixed(2)}</p>
                    </div>
                </div>

                {auction.bids.length > 0 && (
                    <div className="border-t pt-3">
                        <p className="text-xs text-gray-500 mb-2">Recent bids</p>
                        <div className="flex flex-col gap-1">
                            {auction.bids.map((bid) => (
                                <div key={bid.id} className="flex justify-between text-xs">
                                    <span>{bid.bidderName}</span>
                                    <span>${bid.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Link href={`/auctions/${auction.id}`}>
            <div className={cls}>
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="font-medium">{playerItem.item.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{formatItemLabel(playerItem.item)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            {playerItem.acquiredFor === 0 ? "Found in trash" : `Paid $${playerItem.acquiredFor.toFixed(2)}`}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Time left</p>
                        <p className="font-mono font-bold text-sm">{timeLeft}</p>
                    </div>
                </div>

                <div className="flex justify-between mb-3">
                    <div>
                        <p className="text-xs text-gray-500">Current bid</p>
                        <p className="font-bold">${auction.currentBid.toFixed(2)}</p>
                    </div>
                </div>

                {auction.bids.length > 0 && (
                    <div className="border-t pt-3">
                        <p className="text-xs text-gray-500 mb-2">Recent bids</p>
                        <div className="flex flex-col gap-1">
                            {auction.bids.map((bid) => (
                                <div key={bid.id} className="flex justify-between text-xs">
                                    <span>{bid.bidderName}</span>
                                    <span>${bid.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Link>
    );
}

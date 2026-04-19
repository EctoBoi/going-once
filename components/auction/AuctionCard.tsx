"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ItemArtwork from "@/components/ItemArtwork";
import { formatItemLabel } from "@/lib/game/formatItemLabel";
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
    bidCount: number;
    item: {
        id: string;
        name: string;
        description?: string | null;
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

export default function AuctionCard({
    auction,
    currentPlayerId,
    outbid,
    onOpen,
    onBuyNow,
}: {
    auction: Auction;
    currentPlayerId?: string;
    outbid?: boolean;
    onOpen?: () => void;
    onBuyNow?: (auctionId: string) => void;
}) {
    const timeLeft = useCountdown(auction.endsAt);
    const isOwn = currentPlayerId && auction.listedBy === currentPlayerId;
    const isLeading = currentPlayerId && auction.leadingPlayerId === currentPlayerId;

    // Border class priority: own > leading > outbid > default
    let borderCls = "border";
    if (isOwn) borderCls = "border-2 border-blue-400";
    else if (isLeading) borderCls = "border-2 border-yellow-500";
    else if (outbid) borderCls = "border-2 border-red-500";

    const cls = `${borderCls} group rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer relative bg-stone-950/80 ${isOwn ? "bg-gray-900" : ""}`;

    const hostLabel = auction.hostName ?? (auction.hostIsNPC ? "NPC" : "Unknown");

    const cardContent = (
        <>
            {isOwn && <span className="absolute top-2 right-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Your listing</span>}
            {isLeading && !isOwn && (
                <span className="absolute top-2 right-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Leading</span>
            )}
            <div className="mb-3 flex gap-4 pr-20">
                <ItemArtwork itemName={auction.item.name} size={88} priority />
                <div className="min-w-0 flex-1 pt-1">
                    <div className="mb-1">
                        <h2 className="font-semibold text-stone-50">{auction.item.name}</h2>
                        <span className="text-xs text-stone-400 capitalize">{formatItemLabel(auction.item)}</span>
                    </div>
                    <p className="text-xs text-stone-400">
                        Hosted by <span className={auction.hostIsNPC ? "text-yellow-400" : "text-stone-300"}>{hostLabel}</span>
                        {auction.hostIsNPC && <span className="ml-1 text-yellow-500 text-[10px] uppercase tracking-wide font-semibold">NPC</span>}
                    </p>
                </div>
            </div>
            <div className="flex justify-between items-center mt-2">
                <div>
                    <p className="text-xs text-stone-500">Current bid</p>
                    <p className="font-bold text-stone-100">${formatMoney(auction.currentBid)}</p>
                </div>
                {auction.buyNow != null && (
                    <div className="text-center">
                        <p className="text-xs text-stone-500">Buy Now</p>
                        <p className="font-semibold text-emerald-400">${formatMoney(auction.buyNow)}</p>
                    </div>
                )}
                <div className="text-center">
                    <p className="text-xs text-stone-500">Bids</p>
                    <p className="font-semibold text-stone-100">{auction.bidCount}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-stone-500">Time left</p>
                    <p className={`font-mono font-bold ${timeLeft === "Ended" ? "text-red-500" : ""}`}>{timeLeft}</p>
                </div>
            </div>
            {auction.buyNow != null && !isOwn && onBuyNow && timeLeft !== "Ended" && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onBuyNow(auction.id);
                    }}
                    className="mt-6 w-full text-sm bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded font-medium transition-colors"
                >
                    Buy Now — ${formatMoney(auction.buyNow)}
                </button>
            )}
        </>
    );

    if (onOpen) {
        return (
            <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()} className={cls}>
                {cardContent}
            </div>
        );
    }

    return (
        <Link href={`/auctions/${auction.id}`}>
            <div className={cls}>{cardContent}</div>
        </Link>
    );
}

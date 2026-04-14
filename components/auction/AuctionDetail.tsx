"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
    minBid: number;
    endsAt: string;
    status: string;
    item: {
        name: string;
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

export default function AuctionDetail({ auction, playerWallet }: { auction: Auction; playerWallet: number }) {
    const [currentBid, setCurrentBid] = useState(auction.currentBid);
    const [bids, setBids] = useState(auction.bids);
    const [bidAmount, setBidAmount] = useState("");
    const [wallet, setWallet] = useState(playerWallet);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { timeLeft, ended } = useCountdown(auction.endsAt);
    const router = useRouter();

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel(`auction-${auction.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "Bid",
                    filter: `auctionId=eq.${auction.id}`,
                },
                (payload) => {
                    const newBid = payload.new as {
                        id: string;
                        bidderName: string;
                        amount: number;
                        isNPC: boolean;
                        placedAt: string;
                    };
                    setBids((prev) => [newBid, ...prev]);
                    setCurrentBid(newBid.amount);
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [auction.id]);

    // NPC evaluator timer
    useEffect(() => {
        const interval = setInterval(() => {
            fetch("/api/npc/evaluate", { method: "POST" });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const minNextBid = currentBid + 1;

    async function handleBid() {
        setError(null);
        const amount = parseFloat(bidAmount);

        if (isNaN(amount) || amount < minNextBid) {
            setError(`Minimum bid is $${minNextBid.toFixed(2)}`);
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
        setWallet(data.wallet);
        setBidAmount("");
        setLoading(false);
    }

    return (
        <main className="min-h-screen p-8 max-w-2xl mx-auto">
            <Link href="/auctions" className="text-sm text-gray-500 hover:underline">
                ← Back to auctions
            </Link>

            <div className="mt-6 border rounded-lg p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold">{auction.item.name}</h1>
                        <p className="text-sm text-gray-500 capitalize mt-1">{auction.item.category}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Time left</p>
                        <p className={`font-mono text-xl font-bold ${ended ? "text-red-500" : ""}`}>{timeLeft}</p>
                    </div>
                </div>

                <div className="mt-6 flex justify-between items-center">
                    <div>
                        <p className="text-xs text-gray-500">Current bid</p>
                        <p className="text-3xl font-bold">${currentBid.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Your wallet</p>
                        <p className="text-xl font-semibold">${wallet.toFixed(2)}</p>
                    </div>
                </div>

                {!ended && (
                    <div className="mt-6 flex gap-2">
                        <input
                            type="number"
                            placeholder={`Min $${minNextBid.toFixed(2)}`}
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            className="border rounded p-2 flex-1"
                            min={minNextBid}
                            step="0.01"
                        />
                        <button onClick={handleBid} disabled={loading} className="bg-black text-white px-6 py-2 rounded disabled:opacity-50">
                            {loading ? "Bidding..." : "Bid"}
                        </button>
                    </div>
                )}

                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            <div className="mt-6">
                <h2 className="font-semibold mb-3">Bid History</h2>
                {bids.length === 0 ? (
                    <p className="text-gray-500 text-sm">No bids yet. Be the first!</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {bids.map((bid) => (
                            <div key={bid.id} className="flex justify-between text-sm border-b pb-2">
                                <span className="font-medium">{bid.bidderName}</span>
                                <span>${bid.amount.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

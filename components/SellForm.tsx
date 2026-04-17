"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SellForm({ playerItemId, acquiredFor, onSuccess }: { playerItemId: string; acquiredFor: number; onSuccess?: () => void }) {
    const defaultMinBid = (acquiredFor + 1).toFixed(2);
    const defaultBuyNow = (Math.round(acquiredFor * 1.15 * 100) / 100).toFixed(2);

    const [minBid, setMinBid] = useState(defaultMinBid);
    const [buyNow, setBuyNow] = useState(defaultBuyNow);
    const [duration, setDuration] = useState(3);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isDiving, setIsDiving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch("/api/player/dive-status");
                const data = await res.json();
                if (!mounted) return;
                setIsDiving(Boolean(data?.isDiving));
            } catch (e) {
                // ignore
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    async function handleList() {
        setError(null);
        const minBidAmount = parseFloat(minBid);
        if (isNaN(minBidAmount) || minBidAmount < 0) {
            setError("Enter a valid minimum bid (must be 0 or more)");
            return;
        }

        const buyNowAmount = buyNow.trim() === "" ? undefined : parseFloat(buyNow);
        if (buyNowAmount !== undefined && (isNaN(buyNowAmount) || buyNowAmount < 0)) {
            setError("Buy-now price must be 0 or more, or leave it blank to disable");
            return;
        }

        setLoading(true);
        const res = await fetch("/api/sell", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                playerItemId,
                minBid: minBidAmount,
                buyNow: buyNowAmount,
                durationMinutes: duration,
            }),
        });
        const data = await res.json();

        if (!data.ok) {
            setError(data.error);
            setLoading(false);
            return;
        }

        if (onSuccess) {
            onSuccess();
        } else {
            router.push("/dashboard");
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <label className="text-sm text-gray-400 block mb-1">Minimum bid ($)</label>
                <input type="number" value={minBid} onChange={(e) => setMinBid(e.target.value)} className="border rounded p-2 w-full" min="0" step="0.01" />
            </div>

            <div>
                <label className="text-sm text-gray-400 block mb-1">Buy-now price ($) — optional</label>
                <input
                    type="number"
                    value={buyNow}
                    onChange={(e) => setBuyNow(e.target.value)}
                    placeholder="Leave blank to disable"
                    className="border rounded p-2 w-full"
                    min="0"
                    step="0.01"
                />
            </div>

            <div>
                <label className="text-sm text-gray-400 block mb-1">
                    Duration — {duration} minute{duration !== 1 ? "s" : ""}
                </label>
                <input type="range" min={1} max={10} step={1} value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 min</span>
                    <span>10 min</span>
                </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {isDiving && <p className="text-sm text-yellow-600">You cannot list items while dumpster-diving.</p>}
            <button onClick={handleList} disabled={loading || isDiving} className="bg-black text-white py-2 rounded disabled:opacity-50">
                {loading ? "Listing..." : "List for auction"}
            </button>
        </div>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellForm({ playerItemId }: { playerItemId: string }) {
    const [minBid, setMinBid] = useState("");
    const [duration, setDuration] = useState(2);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleList() {
        setError(null);
        const amount = parseFloat(minBid);
        if (isNaN(amount) || amount <= 0) {
            setError("Enter a valid minimum bid");
            return;
        }

        setLoading(true);
        const res = await fetch("/api/sell", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerItemId, minBid: amount, durationMinutes: duration }),
        });
        const data = await res.json();

        if (!data.ok) {
            setError(data.error);
            setLoading(false);
            return;
        }

        router.push("/dashboard");
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <label className="text-sm text-gray-600 block mb-1">Minimum bid ($)</label>
                <input
                    type="number"
                    placeholder="0.00"
                    value={minBid}
                    onChange={(e) => setMinBid(e.target.value)}
                    className="border rounded p-2 w-full"
                    min="0.01"
                    step="0.01"
                />
            </div>

            <div>
                <label className="text-sm text-gray-600 block mb-1">
                    Duration — {duration} minute{duration !== 1 ? "s" : ""}
                </label>
                <input type="range" min={1} max={10} step={1} value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 min</span>
                    <span>10 min</span>
                </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleList} disabled={loading} className="bg-black text-white py-2 rounded disabled:opacity-50">
                {loading ? "Listing..." : "List for auction"}
            </button>
        </div>
    );
}

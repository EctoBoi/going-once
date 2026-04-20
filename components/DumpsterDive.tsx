"use client";

import { useEffect, useState } from "react";

type DiveState = { status: "idle" } | { status: "diving"; diveFinishesAt: string } | { status: "complete"; awardedItem: { name: string } | null };

export default function DumpsterDive({ initialDiveFinishesAt, onDiveComplete }: { initialDiveFinishesAt: string | null; onDiveComplete?: () => void }) {
    const [state, setState] = useState<DiveState>(
        initialDiveFinishesAt && new Date(initialDiveFinishesAt) > new Date()
            ? { status: "diving", diveFinishesAt: initialDiveFinishesAt }
            : { status: "idle" },
    );
    const [timeLeft, setTimeLeft] = useState("");
    const [loading, setLoading] = useState(false);

    // Countdown and auto-poll when diving
    useEffect(() => {
        if (state.status !== "diving") {
            // avoid synchronous setState in the effect body by scheduling it
            const t = setTimeout(() => setTimeLeft(""), 0);
            return () => clearTimeout(t);
        }

        // initialize timeLeft asynchronously to avoid synchronous renders
        const initT = setTimeout(() => {
            const diff = new Date(state.diveFinishesAt).getTime() - Date.now();
            if (diff > 0) {
                setTimeLeft(`${Math.ceil(diff / 1000)}s`);
            } else {
                setTimeLeft("");
            }
        }, 0);

        const interval = setInterval(async () => {
            const diff = new Date(state.diveFinishesAt).getTime() - Date.now();
            if (diff > 0) {
                const s = Math.ceil(diff / 1000);
                setTimeLeft(`${s}s`);
            } else {
                clearInterval(interval);
                setTimeLeft("");
                // Poll server to complete the dive and get reward
                const res = await fetch("/api/player/dive-status");
                const data = await res.json();
                if (data.completed) {
                    setState({ status: "complete", awardedItem: data.awardedItem ?? null });
                    onDiveComplete?.();
                } else if (!data.isDiving) {
                    setState({ status: "idle" });
                } else {
                    // still diving on server — update diveFinishesAt so effect restarts
                    // prefer server-provided timestamp when available
                    const newFinish = data.diveFinishesAt ?? state.diveFinishesAt;
                    if (newFinish && newFinish !== state.diveFinishesAt) {
                        setState({ status: "diving", diveFinishesAt: newFinish });
                    } else {
                        // no updated finish time; retry polling after a short delay
                        setTimeout(async () => {
                            const r2 = await fetch("/api/player/dive-status");
                            const d2 = await r2.json();
                            if (d2.completed) {
                                setState({ status: "complete", awardedItem: d2.awardedItem ?? null });
                                onDiveComplete?.();
                            } else if (!d2.isDiving) {
                                setState({ status: "idle" });
                            } else if (d2.diveFinishesAt) {
                                setState({ status: "diving", diveFinishesAt: d2.diveFinishesAt });
                            }
                        }, 2000);
                    }
                }
            }
        }, 500);

        return () => {
            clearInterval(interval);
            clearTimeout(initT);
        };
    }, [state]);

    async function startDive() {
        setLoading(true);
        const res = await fetch("/api/player/dumpster-dive", { method: "POST" });
        const data = await res.json();
        setLoading(false);

        if (data.ok) {
            setState({ status: "diving", diveFinishesAt: data.diveFinishesAt });
        } else {
            alert(data.error ?? "Failed to start dive");
        }
    }

    function dismiss() {
        setState({ status: "idle" });
    }

    if (state.status === "complete") {
        return (
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <p className="font-semibold text-green-800">🗑️ Dive complete!</p>
                {state.awardedItem ? (
                    <p className="text-sm text-green-700 mt-1">
                        Found: <span className="font-medium">{state.awardedItem.name}</span>
                    </p>
                ) : (
                    <p className="text-sm text-green-700 mt-1">Nothing useful this time.</p>
                )}
                <button onClick={dismiss} className="mt-3 text-sm border px-3 py-1 rounded bg-green-600 hover:bg-green-500">
                    OK
                </button>
            </div>
        );
    }

    if (state.status === "diving") {
        return (
            <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                <p className="font-semibold text-yellow-800">🗑️ Searching…</p>
                <p className="text-sm text-yellow-700 mt-1">{timeLeft ? `${timeLeft} remaining` : "Almost done…"}</p>
                <p className="text-xs text-yellow-600 mt-2 italic">You cannot bid or list while searching.</p>
            </div>
        );
    }

    return (
        <button
            onClick={startDive}
            disabled={loading}
            className="border rounded-lg p-4 w-full text-left hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
            <p className="font-semibold">🗑️ Dumpster Dive</p>
            <p className="text-sm text-gray-500 mt-1">Search for a low-value item (60-120 seconds). Disables bidding and listing while active.</p>
        </button>
    );
}

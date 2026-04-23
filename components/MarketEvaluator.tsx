"use client";

import { useEffect } from "react";

export default function MarketEvaluator() {
    useEffect(() => {
        let inFlight = false;

        const run = async () => {
            if (inFlight || document.visibilityState !== "visible") {
                return;
            }

            inFlight = true;
            try {
                await fetch("/api/npc/evaluate", { method: "POST", cache: "no-store" });
            } finally {
                inFlight = false;
            }
        };

        let generatedIfEmpty = false;

        (async () => {
            try {
                const res = await fetch("/api/auctions/list");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.auctions) && data.auctions.length === 0) {
                        generatedIfEmpty = true;
                        await run(); // generate auctions once when none exist
                    }
                }
            } catch (e) {
                // ignore and fall back to running normally
            }

            if (!generatedIfEmpty) {
                void run();
            }
        })();

        const interval = setInterval(() => {
            void run();
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    return null;
}

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

        void run();
        const interval = setInterval(() => {
            void run();
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    return null;
}

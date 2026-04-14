"use client";

import { useEffect } from "react";

export default function MarketEvaluator() {
    useEffect(() => {
        const run = () => fetch("/api/npc/evaluate", { method: "POST" });
        run();
        const interval = setInterval(run, 15000);
        return () => clearInterval(interval);
    }, []);

    return null;
}

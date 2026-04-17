"use client";

import { useEffect } from "react";

const INTERVAL_MS = 60_000;

export default function CleanupClient() {
    useEffect(() => {
        let mounted = true;

        async function checkOnce() {
            try {
                const res = await fetch("/api/maintenance/cleanup", { method: "GET" });
                if (!mounted) return;
                if (!res.ok) {
                    console.warn("cleanup client: server responded with", res.status);
                    return;
                }
                const json = await res.json();
                console.debug("cleanup client:", json);
            } catch (err) {
                console.error("cleanup client error:", err);
            }
        }

        // Run immediately, then on interval
        checkOnce();
        const id = setInterval(checkOnce, INTERVAL_MS);
        return () => {
            mounted = false;
            clearInterval(id);
        };
    }, []);

    return null;
}

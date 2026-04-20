"use client";

import { useEffect, useState } from "react";
import AuctionDetail from "./AuctionDetail";

type Bid = {
    id: string;
    bidderName: string;
    amount: number;
    isNPC: boolean;
    playerId: string | null;
    placedAt: string;
};

type AuctionData = {
    id: string;
    currentBid: number;
    minBid: number;
    buyNow?: number | null;
    endsAt: string;
    status: string;
    listedBy: string;
    hostName?: string | null;
    hostIsNPC?: boolean;
    leadingPlayerId?: string | null;
    item: { name: string; category: string };
    bids?: Bid[];
};

type ModalPayload = {
    auction: AuctionData;
    playerWallet: number;
    isOwnListing: boolean;
    currentPlayerId: string;
    currentPlayerName?: string;
};

export default function AuctionModal({
    auctionId,
    onClose,
    onWalletUpdate,
}: {
    auctionId: string;
    onClose: () => void;
    onWalletUpdate?: (wallet: number) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<ModalPayload | null>(null);

    useEffect(() => {
        let mounted = true;

        (async () => {
            // yield to the next tick to avoid synchronous setState inside the effect
            await Promise.resolve();
            if (!mounted) return;

            setLoading(true);
            setError(null);
            setPayload(null);

            try {
                const r = await fetch(`/api/auctions/${auctionId}`);
                const json = await r.json();
                if (!mounted) return;
                if (json.ok) {
                    setPayload({
                        auction: json.auction,
                        playerWallet: json.playerWallet,
                        isOwnListing: json.isOwnListing,
                        currentPlayerId: json.currentPlayerId,
                        currentPlayerName: json.currentPlayerName,
                    });
                } else {
                    setError(json.error ?? "Failed to load auction");
                }
            } catch {
                if (mounted) setError("Failed to load auction");
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [auctionId]);

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 bg-gray-900 w-full max-w-2xl mt-16 mx-4 rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto"
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-20 text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded"
                    aria-label="Close"
                >
                    ×
                </button>

                {loading && <div className="p-12 text-center text-gray-400">Loading…</div>}
                {error && <div className="p-12 text-center text-red-500">{error}</div>}
                {payload && (
                    <AuctionDetail
                        auction={payload.auction}
                        playerWallet={payload.playerWallet}
                        isOwnListing={payload.isOwnListing}
                        currentPlayerId={payload.currentPlayerId}
                        currentPlayerName={payload.currentPlayerName}
                        onClose={onClose}
                        onWalletUpdate={onWalletUpdate}
                    />
                )}
            </div>
        </div>
    );
}

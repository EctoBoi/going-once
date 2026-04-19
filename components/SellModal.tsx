"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SellForm from "@/components/SellForm";
import { formatMoney } from "@/lib/game/priceUtils";

export default function SellModal({
    playerItemId,
    acquiredFor,
    itemName,
    onClose,
    onSuccess,
}: {
    playerItemId: string;
    acquiredFor: number;
    itemName?: string;
    onClose: () => void;
    onSuccess?: () => void;
}) {
    const router = useRouter();
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
            <div className="relative z-10 bg-gray-900 w-full max-w-md mt-20 mx-4 rounded-xl shadow-2xl p-6">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded"
                    aria-label="Close"
                >
                    ×
                </button>
                <h2 className="text-lg font-semibold mb-0.5">List Item for Auction</h2>
                {itemName && (
                    <p className="text-sm text-gray-400 mb-3">
                        {itemName}
                        {acquiredFor > 0 ? ` — paid $${formatMoney(acquiredFor)}` : " — found in trash"}
                    </p>
                )}
                <SellForm
                    playerItemId={playerItemId}
                    acquiredFor={acquiredFor}
                    onSuccess={() => {
                        onSuccess?.();
                        onClose();
                        router.refresh();
                    }}
                />
            </div>
        </div>
    );
}

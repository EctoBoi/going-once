"use client";

import { useEffect } from "react";
import Link from "next/link";
import ItemArtwork from "@/components/ItemArtwork";
import { formatItemLabel } from "@/lib/game/formatItemLabel";
import { formatMoney } from "@/lib/game/priceUtils";

type InventoryItem = {
    id: string;
    acquiredFor: number;
    item: { name: string; description?: string | null; category: string };
};

export default function InventoryModal({
    inventory,
    onClose,
    onSell,
}: {
    inventory: InventoryItem[];
    onClose: () => void;
    onSell: (item: { id: string; acquiredFor: number; itemName: string }) => void;
}) {
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
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 bg-gray-900 text-gray-100 w-full max-w-lg mt-20 mx-4 rounded-xl shadow-2xl max-h-[70vh] flex flex-col"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                    <h2 className="font-bold text-lg">Inventory</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <div className="overflow-y-auto p-4 flex flex-col gap-2">
                    {inventory.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">
                            Nothing here yet.{" "}
                            <Link href="/dashboard" className="text-blue-400 hover:underline" onClick={onClose}>
                                Win an auction
                            </Link>{" "}
                            or go dumpster diving!
                        </p>
                    ) : (
                        inventory.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-700 bg-stone-800/90 p-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <ItemArtwork itemName={item.item.name} size={68} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-stone-50">{item.item.name}</p>
                                        <p className="text-xs text-stone-400 capitalize">{formatItemLabel(item.item)}</p>
                                        <p className="mt-0.5 text-xs text-stone-500">
                                            {item.acquiredFor === 0 ? "Found in trash" : `Paid $${formatMoney(item.acquiredFor)}`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSell({ id: item.id, acquiredFor: item.acquiredFor, itemName: item.item.name });
                                        onClose();
                                    }}
                                    className="shrink-0 rounded border border-stone-600 bg-stone-700 px-3 py-1.5 text-xs transition-colors hover:bg-stone-600"
                                >
                                    List
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

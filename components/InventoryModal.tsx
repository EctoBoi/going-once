"use client";

import { useEffect } from "react";
import Link from "next/link";
import { formatItemLabel } from "@/lib/game/formatItemLabel";

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
                            <div key={item.id} className="border border-gray-700 rounded-lg p-3 flex justify-between items-center gap-2 bg-gray-800">
                                <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{item.item.name}</p>
                                    <p className="text-xs text-gray-400 capitalize">{formatItemLabel(item.item)}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {item.acquiredFor === 0 ? "Found in trash" : `Paid $${item.acquiredFor.toFixed(2)}`}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSell({ id: item.id, acquiredFor: item.acquiredFor, itemName: item.item.name });
                                        onClose();
                                    }}
                                    className="text-xs border border-gray-600 px-3 py-1.5 rounded hover:bg-gray-600 shrink-0 bg-gray-700 transition-colors"
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

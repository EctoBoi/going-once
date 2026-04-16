"use client";

import { useState } from "react";
import Link from "next/link";
import SellModal from "@/components/SellModal";
import ActiveListingCard from "@/components/ActiveListingCard";
import DumpsterDive from "@/components/DumpsterDive";
import AuctionFeed from "@/components/auction/AuctionFeed";
import AuctionModal from "@/components/auction/AuctionModal";
import MarketEvaluator from "@/components/MarketEvaluator";

type InventoryItem = {
    id: string;
    acquiredFor: number;
    item: { name: string; category: string };
};

type ListingAuction = {
    id: string;
    playerItemId: string | null;
    currentBid: number;
    endsAt: string;
    bids: Array<{ id: string; bidderName: string; amount: number; isNPC: boolean; placedAt: string }>;
};

type Auction = {
    id: string;
    currentBid: number;
    minBid: number;
    endsAt: string;
    status: string;
    listedBy: string;
    bidCount: number;
    item: { id: string; name: string; category: string };
};

type Props = {
    wallet: number;
    inventory: InventoryItem[];
    activeListings: InventoryItem[];
    serializedListingAuctions: ListingAuction[];
    initialAuctions: Auction[];
    currentPlayerId: string;
    diveFinishesAt: string | null;
};

export default function DashboardShell({
    wallet,
    inventory,
    activeListings,
    serializedListingAuctions,
    initialAuctions,
    currentPlayerId,
    diveFinishesAt,
}: Props) {
    const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
    const [sellItem, setSellItem] = useState<{ id: string; acquiredFor: number } | null>(null);

    return (
        <div className="flex-1 flex overflow-hidden">
            <MarketEvaluator />

            {/* Left column — Player */}
            <aside className="w-72 shrink-0 border-r flex flex-col overflow-y-auto bg-gray-900 text-gray-100">
                {/* Wallet */}
                <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-xs text-gray-300">Wallet</p>
                    <p className="font-bold text-lg text-white">${wallet.toFixed(2)}</p>
                </div>

                <div className="flex flex-col gap-5 p-4">
                    {/* Inventory */}
                    <section>
                        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-300 mb-2">Inventory</h2>
                        {inventory.length === 0 ? (
                            <p className="text-gray-400 text-sm">Nothing yet. Win an auction.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {inventory.map((item) => (
                                    <div key={item.id} className="border rounded-lg p-3 flex justify-between items-center gap-2 bg-gray-800">
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">{item.item.name}</p>
                                            <p className="text-xs text-gray-500 capitalize">{item.item.category}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {item.acquiredFor === 0 ? "Found in trash" : `Paid $${item.acquiredFor.toFixed(2)}`}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSellItem({ id: item.id, acquiredFor: item.acquiredFor })}
                                            className="text-xs border px-2 py-1 rounded hover:bg-gray-500 shrink-0 bg-gray-700 text-sm"
                                        >
                                            List
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Active listings */}
                    {activeListings.length > 0 && (
                        <section>
                            <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-300 mb-2">Your Listings</h2>
                            <div className="flex flex-col gap-2">
                                {activeListings.map((playerItem) => {
                                    const auction = serializedListingAuctions.find((a) => a.playerItemId === playerItem.id);
                                    return (
                                        <ActiveListingCard
                                            key={playerItem.id}
                                            playerItem={playerItem}
                                            auction={auction ?? null}
                                            onOpen={(id) => setSelectedAuctionId(id)}
                                        />
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Dumpster dive */}
                    <section>
                        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-400 mb-2">Actions</h2>
                        <DumpsterDive initialDiveFinishesAt={diveFinishesAt} />
                    </section>
                </div>
            </aside>

            {/* Right column — Auctions */}
            <main className="flex-1 overflow-y-auto p-4">
                <AuctionFeed initialAuctions={initialAuctions} currentPlayerId={currentPlayerId} onOpenAuction={(id) => setSelectedAuctionId(id)} />
            </main>

            {/* Auction detail modal */}
            {selectedAuctionId && <AuctionModal auctionId={selectedAuctionId} onClose={() => setSelectedAuctionId(null)} />}

            {/* Sell modal */}
            {sellItem && <SellModal playerItemId={sellItem.id} acquiredFor={sellItem.acquiredFor} onClose={() => setSellItem(null)} />}
        </div>
    );
}

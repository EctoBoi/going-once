"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import SellModal from "@/components/SellModal";
import ActiveListingCard from "@/components/ActiveListingCard";
import DumpsterDive from "@/components/DumpsterDive";
import InventoryModal from "@/components/InventoryModal";
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
    buyNow?: number | null;
    endsAt: string;
    status: string;
    listedBy: string;
    hostName?: string | null;
    hostIsNPC?: boolean;
    leadingPlayerId?: string | null;
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

const supabase = createClient();

export default function DashboardShell({
    wallet: initialWallet,
    inventory: initialInventory,
    activeListings: initialActiveListings,
    serializedListingAuctions,
    initialAuctions,
    currentPlayerId,
    diveFinishesAt,
}: Props) {
    const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
    const [sellItem, setSellItem] = useState<{ id: string; acquiredFor: number; itemName: string } | null>(null);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [wallet, setWallet] = useState(initialWallet);
    const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
    const [activeListings, setActiveListings] = useState<InventoryItem[]>(initialActiveListings);
    // Track names of player's listed items for toast messages
    const listingNamesRef = useRef<Map<string, string>>(
        new Map(
            initialActiveListings.map((item) => {
                const auction = serializedListingAuctions.find((a) => a.playerItemId === item.id);
                return [auction?.id ?? "", item.item.name] as [string, string];
            }),
        ),
    );

    async function refreshInventory() {
        try {
            const res = await fetch("/api/player/inventory");
            if (!res.ok) return;
            const data = await res.json();
            if (data.ok) {
                setInventory(data.inventory);
                setActiveListings(data.activeListings);
                setWallet(data.wallet);
            }
        } catch {
            // ignore
        }
    }

    // Supabase realtime: watch player row for wallet changes
    useEffect(() => {
        if (!currentPlayerId) return;

        const topic = `player-wallet:${currentPlayerId}`;

        const subscribe = async () => {
            // Required for private channels + Realtime Authorization
            await supabase.realtime.setAuth();

            supabase
                .channel(topic, { config: { private: true } })
                .on("broadcast", { event: "UPDATE" }, (payload: any) => {
                    // broadcast_changes payload shape includes the change metadata.
                    // The wallet value will be inside the new row data.
                    const updated = payload?.record?.new ?? payload?.new ?? payload?.payload?.new ?? payload;

                    const wallet = updated?.wallet as number | undefined;

                    // If wallet missing, you can treat it like “no WAL field” and refresh:
                    if (wallet !== undefined) {
                        setWallet(wallet);
                    } else {
                        refreshInventory();
                    }
                })
                .subscribe();
        };

        subscribe();

        return () => {
            // safe cleanup: remove the channel by topic
            supabase.removeChannel(supabase.channel(topic, { config: { private: true } }));
        };
    }, [currentPlayerId]);

    // Supabase realtime: watch playerItem table for inventory changes
    useEffect(() => {
        const topic = `playerId-${currentPlayerId}`;
        supabase
            .channel(topic, { config: { private: true } })
            .on("broadcast", { event: "INSERT" }, () => refreshInventory())
            .on("broadcast", { event: "UPDATE" }, () => refreshInventory())
            .on("broadcast", { event: "DELETE" }, () => refreshInventory())
            .subscribe();

        return () => {
            supabase.removeChannel(supabase.channel(topic, { config: { private: true } }));
        };
    }, [currentPlayerId]);

    // Supabase subscription: watch auctions the player listed so we can toast sold / won events
    useEffect(() => {
        const channel = supabase
            .channel("dashboard:player-auctions")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "Auction",
                    filter: `listedBy=eq.${currentPlayerId}`,
                },
                (payload) => {
                    const updated = payload.new as {
                        id: string;
                        status: string;
                        currentBid: number;
                        winningPlayerId: string | null;
                    };

                    if (updated.status === "resolved") {
                        const name = listingNamesRef.current.get(updated.id) ?? "your item";
                        if (updated.winningPlayerId) {
                            toast.success(`💰 Your listing "${name}" sold for $${updated.currentBid.toFixed(2)}!`);
                        } else {
                            toast(`Your listing "${name}" ended with no winner.`, { icon: "ℹ️" });
                        }
                    }
                },
            )
            // Also watch auctions the player is the leading bidder on (to detect wins and refunds)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "Auction",
                },
                (payload) => {
                    const updated = payload.new as {
                        id: string;
                        status: string;
                        currentBid: number;
                        winningPlayerId: string | null;
                        leadingPlayerId: string | null;
                        listedBy: string;
                    };

                    // Player won the auction — also refresh inventory to show the new item
                    if (updated.status === "resolved" && updated.winningPlayerId === currentPlayerId && updated.listedBy !== currentPlayerId) {
                        toast.success(`🎉 You won an item for $${updated.currentBid.toFixed(2)}!`);
                        refreshInventory();
                    }
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentPlayerId]);

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

                <div className="flex flex-col gap-4 p-4">
                    {/* Inventory button */}
                    <section>
                        <button
                            type="button"
                            onClick={() => setInventoryOpen(true)}
                            className="w-full text-lg font-semibold border border-gray-700 px-3 py-4 rounded-lg hover:bg-gray-800 transition-colors text-gray-200 flex items-center justify-between"
                        >
                            <span>🎒 Inventory</span>
                            <span className="text-xs text-gray-400 font-normal">
                                {inventory.length} item{inventory.length !== 1 ? "s" : ""}
                            </span>
                        </button>
                    </section>

                    {/* Dumpster dive */}
                    <section>
                        <DumpsterDive initialDiveFinishesAt={diveFinishesAt} onDiveComplete={refreshInventory} />
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
                </div>
            </aside>

            {/* Right column — Auctions */}
            <main className="flex-1 overflow-y-auto p-4">
                <AuctionFeed initialAuctions={initialAuctions} currentPlayerId={currentPlayerId} onOpenAuction={(id) => setSelectedAuctionId(id)} />
            </main>

            {/* Auction detail modal */}
            {selectedAuctionId && (
                <AuctionModal auctionId={selectedAuctionId} onClose={() => setSelectedAuctionId(null)} onWalletUpdate={(w) => setWallet(w)} />
            )}

            {/* Inventory modal */}
            {inventoryOpen && <InventoryModal inventory={inventory} onClose={() => setInventoryOpen(false)} onSell={(item) => setSellItem(item)} />}

            {/* Sell modal */}
            {sellItem && (
                <SellModal
                    playerItemId={sellItem.id}
                    acquiredFor={sellItem.acquiredFor}
                    itemName={sellItem.itemName}
                    onClose={() => setSellItem(null)}
                    onSuccess={refreshInventory}
                />
            )}
        </div>
    );
}

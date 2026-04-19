"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { extractBroadcastChange } from "@/lib/supabase/realtime";
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
    item?: { id?: string; name?: string; category?: string };
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
import { formatMoney } from "@/lib/game/priceUtils";

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
    const auctionNamesRef = useRef<Map<string, string>>(new Map(initialAuctions.map((auction) => [auction.id, auction.item.name] as [string, string])));
    // Track names of player's listed items for toast messages
    const listingNamesRef = useRef<Map<string, string>>(
        (() => {
            const entries = initialActiveListings
                .map((item) => {
                    const auction = serializedListingAuctions.find((a) => a.playerItemId === item.id);
                    return auction?.id ? ([auction.id, item.item.name] as [string, string]) : null;
                })
                .filter(Boolean) as [string, string][];
            return new Map(entries);
        })(),
    );

    // Map auctionId -> playerItemId for quick sidebar updates when an auction resolves
    const auctionToPlayerItemRef = useRef<Map<string, string>>(
        (() => {
            const entries = initialActiveListings
                .map((item) => {
                    const auction = serializedListingAuctions.find((a) => a.playerItemId === item.id);
                    return auction?.id ? ([auction.id, item.id] as [string, string]) : null;
                })
                .filter(Boolean) as [string, string][];
            return new Map(entries);
        })(),
    );

    // Recent toast timestamps to dedupe duplicate broadcasts
    const recentAuctionToastTimesRef = useRef<Map<string, number>>(new Map());

    // Reactive listing auctions so sidebar cards receive updated auction props
    const [listingAuctions, setListingAuctions] = useState<ListingAuction[]>(serializedListingAuctions);
    // Track active auction-detail channels for player's listings
    const listingDetailChannelsRef = useRef<Map<string, ReturnType<(typeof supabase)["channel"]>>>(new Map());
    const listingAuctionIdsKey = listingAuctions
        .map((auction) => auction.id)
        .sort()
        .join("|");

    const auctionToPlayerRefFromEntries = useCallback((auctionToPlayerEntries: [string, string][], listingNameEntries: [string, string][]) => {
        auctionToPlayerItemRef.current = new Map(auctionToPlayerEntries);
        listingNamesRef.current = new Map(listingNameEntries);
    }, []);

    const recordAuctionToast = useCallback((key: string) => {
        const now = Date.now();
        const last = recentAuctionToastTimesRef.current.get(key) ?? 0;
        if (now - last < 3000) {
            return false;
        }
        recentAuctionToastTimesRef.current.set(key, now);
        return true;
    }, []);

    const refreshInventory = useCallback(async () => {
        try {
            const res = await fetch("/api/player/inventory");
            if (!res.ok) return;
            const data = await res.json();
            if (data.ok) {
                setInventory(data.inventory);
                setActiveListings(data.activeListings);
                // Also refresh the player's listing auctions so sidebar cards get updated
                try {
                    const laRes = await fetch("/api/player/listing-auctions");
                    if (laRes.ok) {
                        const laData = await laRes.json();
                        if (laData.ok && Array.isArray(laData.listingAuctions)) {
                            setListingAuctions(laData.listingAuctions);

                            // rebuild mapping refs from the newly fetched auctions and active listings
                            const auctionToPlayerEntries: [string, string][] = [];
                            const listingNameEntries: [string, string][] = [];
                            for (const pi of data.activeListings) {
                                const match = (laData.listingAuctions as ListingAuction[]).find((a) => a.playerItemId === pi.id);
                                if (match?.id) {
                                    auctionToPlayerEntries.push([match.id, pi.id]);
                                    const name = match.item?.name ?? pi.item.name ?? "item";
                                    listingNameEntries.push([match.id, String(name)]);
                                }
                            }
                            auctionToPlayerRefFromEntries(auctionToPlayerEntries, listingNameEntries);
                        }
                    }
                } catch {
                    // ignore listing-auctions refresh failure
                }
                setWallet(data.wallet);
            }
        } catch {
            // ignore
        }
    }, [auctionToPlayerRefFromEntries]);

    const fetchAuctionSummary = useCallback(async (auctionId: string) => {
        try {
            const res = await fetch(`/api/auctions/${auctionId}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data?.auction ?? null;
        } catch {
            return null;
        }
    }, []);

    // Supabase realtime: watch player row for wallet changes
    useEffect(() => {
        if (!currentPlayerId) return;

        let channelRef: ReturnType<(typeof supabase)["channel"]> | null = null;

        const subscribe = async () => {
            // Required for private channels + Realtime Authorization
            await supabase.realtime.setAuth();

            // Get the authenticated user from the client-side auth state
            const {
                data: { user },
            } = await supabase.auth.getUser();

            const uid = user?.id;
            // Only subscribe if the authenticated user's id matches the provided currentPlayerId
            if (!uid || uid !== currentPlayerId) return;

            const topic = `player-wallet:${uid}`;

            channelRef = supabase
                .channel(topic, { config: { private: true } })
                .on("broadcast", { event: "UPDATE" }, (payload) => {
                    const { record: updated } = extractBroadcastChange(payload);

                    // Best-effort owner check: many payload shapes include the row id or owner field.
                    const ownerId = (updated["id"] ?? updated["player_id"] ?? updated["playerId"] ?? updated["user_id"] ?? updated["userId"]) as string | null;

                    // If ownerId is present and doesn't match, ignore this message.
                    if (ownerId && ownerId !== uid) return;

                    const walletVal = (updated["wallet"] as number) ?? undefined;

                    // If wallet missing, refresh full inventory; otherwise update local wallet value
                    if (walletVal !== undefined) {
                        setWallet(walletVal);
                    } else {
                        refreshInventory();
                    }
                })
                .subscribe();
        };

        subscribe();

        return () => {
            // safe cleanup: remove the channel by reference if we have one
            if (channelRef) {
                supabase.removeChannel(channelRef);
            } else {
                supabase.removeChannel(supabase.channel(`player-wallet:${currentPlayerId}`, { config: { private: true } }));
            }
        };
    }, [currentPlayerId, refreshInventory]);

    // Supabase realtime: watch playerItem table for inventory changes
    useEffect(() => {
        if (!currentPlayerId) return;

        let itemChannel: ReturnType<(typeof supabase)["channel"]> | null = null;

        const subscribe = async () => {
            await supabase.realtime.setAuth();

            const {
                data: { user },
            } = await supabase.auth.getUser();

            const uid = user?.id;
            if (!uid || uid !== currentPlayerId) return;

            const topic = `player-items:${uid}`;
            const handleInventoryChange = (payload: unknown) => {
                const { record, oldRecord } = extractBroadcastChange(payload);
                const ownerId = (record["playerId"] ?? oldRecord["playerId"] ?? record["player_id"] ?? oldRecord["player_id"]) as string | null;

                if (ownerId && ownerId !== uid) return;
                refreshInventory();
            };

            itemChannel = supabase
                .channel(topic, { config: { private: true } })
                .on("broadcast", { event: "INSERT" }, handleInventoryChange)
                .on("broadcast", { event: "UPDATE" }, handleInventoryChange)
                .on("broadcast", { event: "DELETE" }, handleInventoryChange)
                .subscribe();
        };

        subscribe();

        return () => {
            if (itemChannel) {
                supabase.removeChannel(itemChannel);
            }
        };
    }, [currentPlayerId, refreshInventory]);

    // Supabase subscription: watch auctions the player listed so we can toast sold / won events
    useEffect(() => {
        if (!currentPlayerId) return;

        let channel: ReturnType<(typeof supabase)["channel"]> | null = null;

        const subscribe = async () => {
            await supabase.realtime.setAuth();

            const {
                data: { user },
            } = await supabase.auth.getUser();

            const uid = user?.id;
            if (!uid || uid !== currentPlayerId) return;

            const topic = `player-auctions:${uid}`;

            channel = supabase
                .channel(topic, { config: { private: true } })
                .on("broadcast", { event: "UPDATE" }, async (payload) => {
                    const { record, oldRecord } = extractBroadcastChange(payload);
                    const updated = record as {
                        id?: string;
                        status?: string;
                        currentBid?: number;
                        winningPlayerId?: string | null;
                        listedBy?: string;
                        item?: { name?: string };
                    };

                    if (!updated.id) return;

                    // Resolve a friendly item name from several sources (listing map, auction map, payload)
                    const payloadItemName = updated.item?.name as string | undefined;
                    const listedName = listingNamesRef.current.get(updated.id) ?? auctionNamesRef.current.get(updated.id) ?? payloadItemName;

                    // Keep the reactive listingAuctions in sync so the sidebar updates currentBid/bids
                    setListingAuctions(
                        (prev) =>
                            prev.map((a) => {
                                if (a.id !== updated.id) return a;
                                const newCurrentBid = updated.currentBid !== undefined ? updated.currentBid : a.currentBid;
                                return {
                                    ...a,
                                    currentBid: newCurrentBid,
                                } as ListingAuction;
                            }) as ListingAuction[],
                    );

                    const previousStatus = typeof oldRecord.status === "string" ? oldRecord.status : null;
                    if (updated.status !== "resolved" || previousStatus === "resolved") return;

                    const fetched = await fetchAuctionSummary(updated.id);
                    const finalBid = typeof updated.currentBid === "number" ? updated.currentBid : fetched?.currentBid;
                    const listedBy = updated.listedBy ?? fetched?.listedBy;
                    const winningPlayerId = updated.winningPlayerId ?? fetched?.winningPlayerId ?? null;
                    const resolvedName = listedName ?? fetched?.item?.name ?? "item";
                    const hadAnyBids = (Array.isArray(fetched?.bids) && fetched.bids.length > 0) || Boolean(winningPlayerId);
                    const affectsOwner = listedBy === uid;
                    const affectsWinner = winningPlayerId === uid;

                    if (finalBid === undefined) {
                        if (affectsOwner || affectsWinner) {
                            refreshInventory();
                        }
                        return;
                    }

                    if (affectsOwner && recordAuctionToast(`${updated.id}:sold`)) {
                        if (hadAnyBids) {
                            toast.success(`💰 Your listing for a ${resolvedName} sold for $${formatMoney(finalBid)}!`);
                        } else {
                            toast(`Your listing for a ${resolvedName} ended with no winner.`, { icon: "ℹ️" });
                        }
                    }

                    if (affectsWinner && recordAuctionToast(`${updated.id}:won`)) {
                        toast.success(`🎉 You won a ${resolvedName} for $${formatMoney(finalBid)}!`);
                    }

                    let refreshed = false;
                    if (affectsOwner) {
                        const playerItemId = auctionToPlayerItemRef.current.get(updated.id);
                        if (playerItemId) {
                            setActiveListings((prev) => prev.filter((pi) => pi.id !== playerItemId));
                            auctionToPlayerItemRef.current.delete(updated.id);
                            listingNamesRef.current.delete(updated.id);
                            setListingAuctions((prev) => prev.filter((a) => a.id !== updated.id));
                        } else {
                            refreshed = true;
                        }
                    }

                    if (affectsWinner) {
                        refreshed = true;
                    }

                    if (refreshed) {
                        refreshInventory();
                    }
                    return;

                    // For non-resolved owner/winner updates (e.g., new bid), we've already updated `listingAuctions` above
                    // so do not remove the sidebar entry. Only resolved/delete flows remove the listing.
                })
                .on("broadcast", { event: "DELETE" }, () => {
                    // If an auction is deleted, refresh listings to remove it from the sidebar
                    refreshInventory();
                })
                .subscribe();
        };

        subscribe();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [currentPlayerId, fetchAuctionSummary, recordAuctionToast, refreshInventory]);

    // Subscribe to per-listing auction-detail channels so sidebar shows live bids
    useEffect(() => {
        if (!currentPlayerId) return;

        const existing = listingDetailChannelsRef.current;
        const desiredIds = new Set(listingAuctionIdsKey ? listingAuctionIdsKey.split("|") : []);

        // Unsubscribe channels that are no longer desired
        for (const [id, ch] of Array.from(existing.entries())) {
            if (!desiredIds.has(id)) {
                try {
                    supabase.removeChannel(ch);
                } catch {}
                existing.delete(id);
            }
        }

        // Subscribe to new listing channels
        for (const id of Array.from(desiredIds)) {
            if (existing.has(id)) continue;
            const ch = supabase
                .channel(`auction-detail:${id}`, { config: { private: true } })
                .on("broadcast", { event: "INSERT" }, (payload) => {
                    const { record } = extractBroadcastChange(payload);
                    const newBid = record as {
                        id?: string;
                        bidderName?: string;
                        amount?: number;
                        isNPC?: boolean;
                        playerId?: string | null;
                        placedAt?: string;
                    };
                    if (!newBid.id || typeof newBid.amount !== "number") return;

                    // Narrow to non-nullable locals so TypeScript knows these are defined
                    const bidId: string = newBid.id;
                    const bidAmount: number = newBid.amount;

                    setListingAuctions(
                        (prev) =>
                            prev.map((a) => {
                                if (a.id !== id) return a;
                                // dedupe
                                if (a.bids.some((b) => b.id === bidId)) return a;
                                const cleaned = a.bids.filter((b) => !b.id.startsWith("optimistic-"));
                                const typedBid: ListingAuction["bids"][number] = {
                                    id: bidId,
                                    bidderName: newBid.bidderName ?? "",
                                    amount: bidAmount,
                                    isNPC: Boolean(newBid.isNPC),
                                    placedAt: newBid.placedAt ?? new Date().toISOString(),
                                };
                                return { ...a, bids: [typedBid, ...cleaned], currentBid: bidAmount } as ListingAuction;
                            }) as ListingAuction[],
                    );
                })
                .subscribe();

            existing.set(id, ch);
        }

        return () => {
            // use the captured `existing` variable to avoid ref-change issues in cleanup
            for (const ch of existing.values()) {
                try {
                    supabase.removeChannel(ch);
                } catch {}
            }
            existing.clear();
        };
    }, [currentPlayerId, listingAuctionIdsKey]);

    return (
        <div className="flex-1 flex overflow-hidden">
            <MarketEvaluator />

            {/* Left column — Player */}
            <aside className="w-72 shrink-0 border-r flex flex-col overflow-y-auto bg-gray-900 text-gray-100">
                {/* Wallet */}
                <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-xs text-gray-300">Wallet</p>
                    <p className="font-bold text-lg text-white">${formatMoney(wallet)}</p>
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
                                    const auction = listingAuctions.find((a) => a.playerItemId === playerItem.id);
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

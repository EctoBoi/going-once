import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ActiveListingCard from "@/components/ActiveListingCard";
import MarketEvaluator from "@/components/MarketEvaluator";
import { reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";

export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    await reconcileAuctionLifecycle();

    const player = await prisma.player.findUnique({
        where: { id: user.id },
    });

    const inventory = await prisma.playerItem.findMany({
        where: {
            playerId: user.id,
            listedAt: null,
        },
        include: { item: true },
    });

    const activeListings = await prisma.playerItem.findMany({
        where: {
            playerId: user.id,
            listedAt: { not: null },
        },
        include: { item: true },
    });

    const activeListingAuctions = await prisma.auction.findMany({
        where: {
            playerItemId: { in: activeListings.map((listing) => listing.id) },
            listedBy: user.id,
            status: { in: ["active", "resolving"] },
        },
        include: {
            bids: {
                orderBy: { placedAt: "desc" },
                take: 5,
            },
        },
    });

    const serializedListingAuctions = activeListingAuctions.map((a) => ({
        ...a,
        endsAt: a.endsAt.toISOString(),
        bids: a.bids.map((b) => ({ ...b, placedAt: b.placedAt.toISOString() })),
    }));

    return (
        <main className="min-h-screen p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">Going Once</h1>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Wallet</p>
                        <p className="font-bold text-lg">${player?.wallet.toFixed(2) ?? "0.00"}</p>
                    </div>
                    <Link href="/auctions" className="bg-black text-white px-4 py-2 rounded text-sm">
                        Browse Auctions
                    </Link>
                </div>
            </div>
            {/* Inventory */}
            <section className="mb-8">
                <h2 className="font-semibold text-lg mb-4">Inventory</h2>
                {inventory.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nothing yet. Win an auction to get started.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inventory.map((playerItem) => (
                            <div key={playerItem.id} className="border rounded-lg p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{playerItem.item.name}</p>
                                    <p className="text-xs text-gray-500 capitalize">{playerItem.item.category}</p>
                                    <p className="text-xs text-gray-400 mt-1">Paid ${playerItem.acquiredFor.toFixed(2)}</p>
                                </div>
                                <Link href={`/sell/${playerItem.id}`} className="text-sm border px-3 py-1 rounded hover:bg-gray-50">
                                    List
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            {/* Active listings */}
            <section>
                <h2 className="font-semibold text-lg mb-4">Active Listings</h2>
                {activeListings.length === 0 ? (
                    <p className="text-gray-500 text-sm">No active listings.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeListings.map((playerItem) => {
                            const auction = serializedListingAuctions.find((a) => a.playerItemId === playerItem.id);
                            return <ActiveListingCard key={playerItem.id} playerItem={playerItem} auction={auction ?? null} />;
                        })}
                    </div>
                )}
            </section>
            <MarketEvaluator />
        </main>
    );
}

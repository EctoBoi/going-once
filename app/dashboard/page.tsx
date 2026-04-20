import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    // Fire reconciliation in the background — don't block page render
    reconcileAuctionLifecycle().catch(() => {});

    return (
        <Suspense fallback={<DashboardLoadingShell />}>
            <DashboardData userId={user.id} />
        </Suspense>
    );
}

async function DashboardData({ userId }: { userId: string }) {
    const [player, inventory, activeListings, activeAuctions] = await Promise.all([
        prisma.player.findUnique({ where: { id: userId } }),
        prisma.playerItem.findMany({
            where: { playerId: userId, listedAt: null },
            include: { item: true },
        }),
        prisma.playerItem.findMany({
            where: { playerId: userId, listedAt: { not: null } },
            include: { item: true },
        }),
        prisma.auction.findMany({
            where: { status: "active" },
            include: {
                item: true,
                _count: { select: { bids: true } },
            },
            orderBy: { endsAt: "asc" },
        }),
    ]);

    const listingAuctions = await prisma.auction.findMany({
        where: {
            playerItemId: { in: activeListings.map((l) => l.id) },
            listedBy: userId,
            status: { in: ["active", "resolving"] },
        },
        include: {
            bids: { orderBy: { placedAt: "desc" }, take: 5 },
        },
    });

    const serializedListingAuctions = listingAuctions.map((a) => ({
        ...a,
        endsAt: a.endsAt.toISOString(),
        bids: a.bids.map((b) => ({ ...b, placedAt: b.placedAt.toISOString() })),
    }));

    const serializedAuctions = activeAuctions.map((a) => ({
        id: a.id,
        currentBid: a.currentBid,
        minBid: a.minBid,
        buyNow: a.buyNow,
        endsAt: a.endsAt.toISOString(),
        status: a.status,
        listedBy: a.listedBy,
        hostName: a.hostName,
        hostIsNPC: a.hostIsNPC,
        leadingPlayerId: a.leadingPlayerId,
        bidCount: a._count.bids,
        item: a.item,
    }));

    return (
        <DashboardShell
            wallet={player?.wallet ?? 0}
            inventory={inventory}
            activeListings={activeListings}
            serializedListingAuctions={serializedListingAuctions}
            initialAuctions={serializedAuctions}
            currentPlayerId={userId}
            diveFinishesAt={player?.diveFinishesAt?.toISOString() ?? null}
        />
    );
}

function DashboardLoadingShell() {
    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Left sidebar skeleton */}
            <aside className="hidden md:flex w-72 shrink-0 border-r flex-col overflow-y-auto bg-gray-900 text-gray-100">
                <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-xs text-gray-300">Wallet</p>
                    <div className="h-6 w-24 bg-gray-700 rounded animate-pulse mt-1" />
                </div>
                <div className="flex flex-col gap-4 p-4">
                    <div className="w-full border border-gray-700 px-3 py-4 rounded-lg text-gray-500 flex items-center justify-between opacity-40 cursor-not-allowed select-none">
                        <span>🎒 Inventory</span>
                        <span className="text-xs">—</span>
                    </div>
                    <div className="border border-gray-700 rounded-lg p-4 opacity-40">
                        <div className="h-4 w-28 bg-gray-700 rounded animate-pulse mb-2" />
                        <div className="h-8 w-full bg-gray-700 rounded animate-pulse" />
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="h-6 w-32 bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
                    <p className="text-gray-400 text-sm animate-pulse">Loading auctions…</p>
                </div>
            </main>
        </div>
    );
}

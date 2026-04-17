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

    await reconcileAuctionLifecycle();

    const [player, inventory, activeListings, activeAuctions] = await Promise.all([
        prisma.player.findUnique({ where: { id: user.id } }),
        prisma.playerItem.findMany({
            where: { playerId: user.id, listedAt: null },
            include: { item: true },
        }),
        prisma.playerItem.findMany({
            where: { playerId: user.id, listedAt: { not: null } },
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
            listedBy: user.id,
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
            currentPlayerId={user.id}
            diveFinishesAt={player?.diveFinishesAt?.toISOString() ?? null}
        />
    );
}

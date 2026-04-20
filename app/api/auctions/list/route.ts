import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Fire reconciliation in background — don't block the list response
    reconcileAuctionLifecycle().catch(() => {});

    const auctions = await prisma.auction.findMany({
        where: { status: "active" },
        include: {
            item: true,
            _count: { select: { bids: true } },
        },
        orderBy: { endsAt: "asc" },
    });

    const serialized = auctions.map((a) => ({
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

    return NextResponse.json({ ok: true, auctions: serialized });
}

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { reconcileAuctionById } from "@/lib/game/auctionLifecycle";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const requestUrl = new URL(_req.url);
    const includeBids = requestUrl.searchParams.get("includeBids") === "1";

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await reconcileAuctionById(id);

    const [auction, player] = await Promise.all([
        prisma.auction.findUnique({
            where: { id },
            include: includeBids
                ? {
                      item: true,
                      bids: {
                          orderBy: { placedAt: "desc" },
                          take: 10,
                      },
                  }
                : {
                      item: true,
                  },
        }),
        prisma.player.findUnique({ where: { id: user.id } }),
    ]);

    if (!auction) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({
        ok: true,
        auction: {
            ...auction,
            endsAt: auction.endsAt.toISOString(),
            ...(includeBids
                ? {
                      bids: auction.bids.map((b) => ({ ...b, placedAt: b.placedAt.toISOString() })),
                  }
                : {}),
        },
        playerWallet: player?.wallet ?? 0,
        isOwnListing: auction.listedBy === user.id,
        currentPlayerId: user.id,
        currentPlayerName: player?.username ?? user.email ?? `Player-${user.id.slice(0, 6)}`,
    });
}

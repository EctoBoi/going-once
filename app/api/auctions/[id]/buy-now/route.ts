import { AuctionLifecycleError, executeBuyNow, reconcileAuctionById } from "@/lib/game/auctionLifecycle";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const player = await prisma.player.findUnique({
            where: { id: user.id },
            select: { username: true, isDiving: true, wallet: true },
        });
        if (!player) return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });
        if (player.isDiving) return NextResponse.json({ ok: false, error: "Cannot buy while diving" }, { status: 403 });

        const buyerName = player.username ?? `Player-${user.id.slice(0, 6)}`;

        await reconcileAuctionById(id);
        await executeBuyNow({
            auctionId: id,
            bidderName: buyerName,
            playerId: user.id,
            isPlayer: true,
        });

        const updatedPlayer = await prisma.player.findUnique({ where: { id: user.id }, select: { wallet: true } });

        return NextResponse.json({ ok: true, wallet: updatedPlayer?.wallet ?? 0 });
    } catch (error) {
        if (error instanceof AuctionLifecycleError) {
            return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
        }
        console.error("Buy-now error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

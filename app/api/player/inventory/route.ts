import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const [player, inventory, activeListings] = await Promise.all([
        prisma.player.findUnique({ where: { id: user.id }, select: { wallet: true } }),
        prisma.playerItem.findMany({
            where: { playerId: user.id, listedAt: null },
            include: { item: true },
        }),
        prisma.playerItem.findMany({
            where: { playerId: user.id, listedAt: { not: null } },
            include: { item: true },
        }),
    ]);

    return NextResponse.json({
        ok: true,
        wallet: player?.wallet ?? 0,
        inventory,
        activeListings,
    });
}

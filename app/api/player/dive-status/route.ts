import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/player/dive-status
 * Returns current dive state. If the dive timer has expired, awards a random
 * low-value item and clears the diving flag.
 */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const player = await prisma.player.findUnique({ where: { id: user.id } });
    if (!player) return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });

    if (!player.isDiving) {
        return NextResponse.json({ ok: true, isDiving: false });
    }

    const now = new Date();
    if (!player.diveFinishesAt || player.diveFinishesAt > now) {
        return NextResponse.json({
            ok: true,
            isDiving: true,
            diveFinishesAt: player.diveFinishesAt?.toISOString() ?? null,
        });
    }

    // Dive complete — award a random item to the player
    const randomItem = await prisma.item.findFirst({
        orderBy: { internalValue: "asc" },
        skip: Math.floor(Math.random() * 8), // pick from cheapest 8 items
    });

    let awardedItem: { name: string } | null = null;

    await prisma.$transaction(async (tx) => {
        await tx.player.update({
            where: { id: user.id },
            data: { isDiving: false, diveFinishesAt: null },
        });

        if (randomItem) {
            await tx.playerItem.create({
                data: {
                    playerId: user.id,
                    itemId: randomItem.id,
                    acquiredFor: 0,
                },
            });
        }
    });

    if (randomItem) {
        awardedItem = { name: randomItem.name };
    }

    return NextResponse.json({ ok: true, isDiving: false, completed: true, awardedItem });
}

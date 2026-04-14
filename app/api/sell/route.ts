import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const { playerItemId, minBid, durationMinutes } = await request.json();

        const playerItem = await prisma.playerItem.findUnique({
            where: { id: playerItemId },
        });

        if (!playerItem) return NextResponse.json({ ok: false, error: "Item not found" }, { status: 404 });
        if (playerItem.playerId !== user.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        if (playerItem.listedAt) return NextResponse.json({ ok: false, error: "Already listed" }, { status: 400 });

        const clampedDuration = Math.min(10, Math.max(1, durationMinutes ?? 2));
        const endsAt = new Date(Date.now() + clampedDuration * 60 * 1000);

        await Promise.all([
            prisma.auction.create({
                data: {
                    itemId: playerItem.itemId,
                    minBid,
                    currentBid: minBid,
                    endsAt,
                    listedBy: user.id,
                    status: "active",
                },
            }),
            prisma.playerItem.update({
                where: { id: playerItemId },
                data: { listedAt: new Date() },
            }),
        ]);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Sell error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

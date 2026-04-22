import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MIN_DIVE_MS = 60_000;
const MAX_DIVE_MS = 120_000;

export async function POST() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const player = await prisma.player.findUnique({ where: { id: user.id } });
    if (!player) return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });

    if (player.isDiving && player.diveFinishesAt && player.diveFinishesAt > new Date()) {
        return NextResponse.json({ ok: false, error: "Already searching", diveFinishesAt: player.diveFinishesAt.toISOString() }, { status: 409 });
    }

    const durationMs = MIN_DIVE_MS + Math.random() * (MAX_DIVE_MS - MIN_DIVE_MS);
    const diveFinishesAt = new Date(Date.now() + durationMs);

    await prisma.player.update({
        where: { id: user.id },
        data: { isDiving: true, diveFinishesAt },
    });

    return NextResponse.json({ ok: true, diveFinishesAt: diveFinishesAt.toISOString() });
}

export async function DELETE() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const player = await prisma.player.findUnique({ where: { id: user.id } });
    if (!player) return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });

    if (!player.isDiving) {
        return NextResponse.json({ ok: true, isDiving: false, cancelled: false });
    }

    // Cancel the dive early with no reward
    await prisma.player.update({ where: { id: user.id }, data: { isDiving: false, diveFinishesAt: null } });

    return NextResponse.json({ ok: true, cancelled: true });
}

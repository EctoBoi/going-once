import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shouldRunCleanup, cleanupStaleData } from "@/lib/game/cleanup";
import { adminClient } from "@/lib/supabase/admin";

/**
 * GET /api/maintenance/cleanup
 *
 * Serverless-friendly cleanup trigger. Invoke on a schedule via Vercel Cron:
 *
 *   vercel.json:
 *   {
 *     "crons": [{ "path": "/api/maintenance/cleanup", "schedule": "* * * * *" }]
 *   }
 *
 * Vercel Cron fires at most once per minute. The route itself only performs
 * work when the last cleanup is older than 15 minutes (guarded by KeyValue).
 */
export async function GET() {
    const owned = await shouldRunCleanup(prisma);
    if (!owned) {
        return NextResponse.json({ skipped: true }, { status: 200 });
    }

    const result = await cleanupStaleData(prisma);
    const guestsDeleted = await cleanupExpiredGuests();
    return NextResponse.json({ cleaned: true, ...result, guestsDeleted }, { status: 200 });
}

async function cleanupExpiredGuests(): Promise<number> {
    const now = new Date();
    const expiredGuests = await prisma.player.findMany({
        where: { isGuest: true, guestExpiresAt: { lte: now } },
        select: { id: true },
    });

    if (expiredGuests.length === 0) return 0;

    // Delete from Supabase Auth first (best-effort per account)
    for (const guest of expiredGuests) {
        try {
            await adminClient.auth.admin.deleteUser(guest.id);
        } catch {
            // Ignore individual failures — Prisma deletion still proceeds
        }
    }

    // Delete Player rows (cascades to related bids, reservations, etc. via DB)
    const ids = expiredGuests.map((g) => g.id);
    await prisma.player.deleteMany({ where: { id: { in: ids } } });

    return expiredGuests.length;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shouldRunCleanup, cleanupStaleData } from "@/lib/game/cleanup";

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
    return NextResponse.json({ cleaned: true, ...result }, { status: 200 });
}

import { replenishAuctions, expireAuctions } from "@/lib/game/auctionEngine";
import { resolveEndedAuctions } from "@/lib/game/auctionResolver";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        await resolveEndedAuctions();
        await expireAuctions();
        await replenishAuctions();
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Replenish error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

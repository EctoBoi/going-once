import { evaluateNPCBids } from "@/lib/npc/evaluator";
import { resolveEndedAuctions } from "@/lib/game/auctionResolver";
import { replenishAuctions, expireAuctions } from "@/lib/game/auctionEngine";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        await resolveEndedAuctions();
        await expireAuctions();
        await replenishAuctions();
        await evaluateNPCBids();
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("NPC evaluation error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

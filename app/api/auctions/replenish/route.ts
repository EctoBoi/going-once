import { replenishAuctions, expireAuctions } from "@/lib/game/auctionEngine";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        await expireAuctions();
        await replenishAuctions();
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Replenish error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

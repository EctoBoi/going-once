import { reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        await reconcileAuctionLifecycle();
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Replenish error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

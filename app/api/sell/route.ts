import { AuctionLifecycleError, createListing, reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";
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

        const clampedDuration = Math.min(10, Math.max(1, durationMinutes ?? 2));

        await reconcileAuctionLifecycle();
        await createListing({
            playerId: user.id,
            playerItemId,
            minBid,
            durationMinutes: clampedDuration,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof AuctionLifecycleError) {
            return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
        }
        console.error("Sell error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

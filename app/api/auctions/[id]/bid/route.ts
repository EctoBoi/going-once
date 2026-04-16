import { AuctionLifecycleError, placeBid, reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const { amount } = await request.json();

        await reconcileAuctionLifecycle();
        const result = await placeBid({
            auctionId: id,
            bidderName: "You",
            amount,
            isNPC: false,
            playerId: user.id,
        });

        return NextResponse.json({
            ok: true,
            currentBid: result.currentBid,
            wallet: result.wallet,
            bid: {
                ...result.bid,
                placedAt: result.bid.placedAt.toISOString(),
            },
        });
    } catch (error) {
        if (error instanceof AuctionLifecycleError) {
            return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
        }
        console.error("Bid error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

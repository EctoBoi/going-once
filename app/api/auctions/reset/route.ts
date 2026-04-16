import { resetAuctionStateForTesting } from "@/lib/game/auctionLifecycle";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ ok: false, error: "Reset is disabled in production" }, { status: 403 });
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        await resetAuctionStateForTesting();
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Auction reset error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

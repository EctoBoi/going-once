import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const listingAuctions = await prisma.auction.findMany({
        where: {
            listedBy: user.id,
            status: { in: ["active", "resolving"] },
        },
        include: { bids: { orderBy: { placedAt: "desc" }, take: 5 } },
    });

    const serialized = listingAuctions.map((a) => ({
        ...a,
        endsAt: a.endsAt.toISOString(),
        bids: a.bids.map((b) => ({ ...b, placedAt: b.placedAt.toISOString() })),
    }));

    return NextResponse.json({ ok: true, listingAuctions: serialized });
}

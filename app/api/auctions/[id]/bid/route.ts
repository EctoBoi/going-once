import { prisma } from "@/lib/prisma";
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

        const auction = await prisma.auction.findUnique({ where: { id } });
        if (!auction) return NextResponse.json({ ok: false, error: "Auction not found" }, { status: 404 });
        if (auction.status !== "active") return NextResponse.json({ ok: false, error: "Auction has ended" }, { status: 400 });
        if (new Date() > auction.endsAt) return NextResponse.json({ ok: false, error: "Auction has ended" }, { status: 400 });
        if (amount <= auction.currentBid)
            return NextResponse.json({ ok: false, error: `Bid must be higher than $${auction.currentBid.toFixed(2)}` }, { status: 400 });

        const player = await prisma.player.findUnique({ where: { id: user.id } });
        if (!player) return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });
        if (amount > player.wallet) return NextResponse.json({ ok: false, error: "Insufficient funds" }, { status: 400 });

        const [updatedPlayer, bid] = await Promise.all([
            prisma.player.update({
                where: { id: user.id },
                data: { wallet: { decrement: amount } },
            }),
            prisma.bid.create({
                data: {
                    auctionId: id,
                    bidderName: "You",
                    amount,
                    isNPC: false,
                    playerId: user.id,
                    placedAt: new Date(),
                },
            }),
        ]);

        await prisma.auction.update({
            where: { id },
            data: { currentBid: amount },
        });

        return NextResponse.json({
            ok: true,
            currentBid: amount,
            wallet: updatedPlayer.wallet,
            bid: {
                ...bid,
                placedAt: bid.placedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error("Bid error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}

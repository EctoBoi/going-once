import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuctionFeed from "@/components/auction/AuctionFeed";
import Link from "next/link";

export default async function AuctionsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const now = new Date();

    const auctions = await prisma.auction.findMany({
        where: {
            status: "active",
            endsAt: { gt: now },
        },
        include: {
            item: true,
            _count: { select: { bids: true } },
        },
        orderBy: { endsAt: "asc" },
    });

    const serialized = auctions.map((a) => ({
        id: a.id,
        currentBid: a.currentBid,
        minBid: a.minBid,
        endsAt: a.endsAt.toISOString(),
        status: a.status,
        listedBy: a.listedBy,
        bidCount: a._count.bids,
        item: a.item,
    }));

    return (
        <main className="min-h-screen p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Active Auctions</h1>
                <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
                    ← Dashboard
                </Link>
            </div>
            <AuctionFeed initialAuctions={serialized} currentPlayerId={user.id} />
        </main>
    );
}

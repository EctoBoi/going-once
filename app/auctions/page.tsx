import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { replenishAuctions, expireAuctions } from "@/lib/game/auctionEngine";
import AuctionFeed from "@/components/auction/AuctionFeed";

export default async function AuctionsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    await expireAuctions();
    await replenishAuctions();

    const auctions = await prisma.auction.findMany({
        where: { status: "active" },
        include: { item: true },
        orderBy: { endsAt: "asc" },
    });

    const serialized = auctions.map((a) => ({
        ...a,
        endsAt: a.endsAt.toISOString(),
    }));

    return (
        <main className="min-h-screen p-8">
            <h1 className="text-2xl font-bold mb-6">Active Auctions</h1>
            <AuctionFeed initialAuctions={serialized} />
        </main>
    );
}

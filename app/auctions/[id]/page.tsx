import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import AuctionDetail from "@/components/auction/AuctionDetail";
import { reconcileAuctionById } from "@/lib/game/auctionLifecycle";

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    await reconcileAuctionById(id);

    const [auction, player] = await Promise.all([
        prisma.auction.findUnique({
            where: { id },
            include: {
                item: true,
            },
        }),
        prisma.player.findUnique({
            where: { id: user.id },
        }),
    ]);

    if (!auction) notFound();

    const serialized = {
        ...auction,
        endsAt: auction.endsAt.toISOString(),
    };

    const isOwnListing = auction.listedBy === user.id;

    const currentPlayerName = player?.username ?? user.email ?? `Player-${user.id.slice(0, 6)}`;

    return (
        <AuctionDetail
            auction={serialized}
            playerWallet={player?.wallet ?? 0}
            isOwnListing={isOwnListing}
            currentPlayerId={user.id}
            currentPlayerName={currentPlayerName}
        />
    );
}

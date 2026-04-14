import { prisma } from "@/lib/prisma";

export async function resolveEndedAuctions() {
    const endedAuctions = await prisma.auction.findMany({
        where: {
            status: "active",
            endsAt: { lte: new Date() },
        },
        include: {
            bids: {
                orderBy: { amount: "desc" },
                take: 1,
            },
        },
    });

    console.log(`Resolving ${endedAuctions.length} ended auctions`);

    for (const auction of endedAuctions) {
        const winningBid = auction.bids[0];

        // Player listed, no bids — return item to inventory
        if (!winningBid && auction.listedBy !== "system") {
            await Promise.all([
                prisma.auction.update({
                    where: { id: auction.id },
                    data: { status: "ended" },
                }),
                prisma.playerItem.updateMany({
                    where: {
                        playerId: auction.listedBy,
                        itemId: auction.itemId,
                        listedAt: { not: null },
                    },
                    data: { listedAt: null },
                }),
            ]);
            continue;
        }

        // No bids, system listed — just end it
        if (!winningBid) {
            await prisma.auction.update({
                where: { id: auction.id },
                data: { status: "ended" },
            });
            continue;
        }

        // NPC won
        if (winningBid.isNPC) {
            // If player listed it, pay them out
            if (auction.listedBy !== "system") {
                await Promise.all([
                    prisma.auction.update({
                        where: { id: auction.id },
                        data: { status: "ended" },
                    }),
                    prisma.player.update({
                        where: { id: auction.listedBy },
                        data: { wallet: { increment: winningBid.amount } },
                    }),
                    prisma.playerItem.deleteMany({
                        where: {
                            playerId: auction.listedBy,
                            itemId: auction.itemId,
                        },
                    }),
                ]);
            } else {
                await prisma.auction.update({
                    where: { id: auction.id },
                    data: { status: "ended" },
                });
            }
            continue;
        }

        // Player won a system auction
        if (winningBid.playerId) {
            await Promise.all([
                prisma.auction.update({
                    where: { id: auction.id },
                    data: { status: "ended" },
                }),
                prisma.playerItem.create({
                    data: {
                        playerId: winningBid.playerId,
                        itemId: auction.itemId,
                        acquiredFor: winningBid.amount,
                    },
                }),
            ]);
        }
    }
}

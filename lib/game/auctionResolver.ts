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

    //console.log(`Resolving ${endedAuctions.length} ended auctions`);

    for (const auction of endedAuctions) {
        const winningBid = auction.bids[0];
        //console.log(`Auction ${auction.id}: winningBid=`, winningBid);

        if (!winningBid || winningBid.isNPC) {
            //console.log(`Auction ${auction.id}: no player winner, marking ended`);
            await prisma.auction.update({
                where: { id: auction.id },
                data: { status: "ended" },
            });
            continue;
        }

        if (winningBid.playerId) {
            //console.log(`Auction ${auction.id}: player ${winningBid.playerId} won, creating PlayerItem`);
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
            //console.log(`Auction ${auction.id}: resolved successfully`);
        } else {
            //console.log(`Auction ${auction.id}: winning bid has no playerId`);
        }
    }
}

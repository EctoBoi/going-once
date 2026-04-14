import { prisma } from "@/lib/prisma";

// How many system auctions should be active at once
const TARGET_ACTIVE_AUCTIONS = 5;

// Auction duration in milliseconds (1-3 minutes)
function randomDuration() {
    const min = 1 * 60 * 1000;
    const max = 3 * 60 * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Min bid is 40-70% of internal value
function randomMinBid(internalValue: number) {
    const factor = 0.4 + Math.random() * 0.3;
    return Math.round(internalValue * factor * 100) / 100;
}

export async function replenishAuctions() {
    // Count currently active system auctions
    const activeCount = await prisma.auction.count({
        where: {
            status: "active",
            listedBy: "system",
        },
    });

    const needed = TARGET_ACTIVE_AUCTIONS - activeCount;
    if (needed <= 0) return;

    // Get all items that don't have an active auction
    const activeAuctionItemIds = await prisma.auction.findMany({
        where: { status: "active" },
        select: { itemId: true },
    });

    const excludedIds = activeAuctionItemIds.map((a) => a.itemId);

    const availableItems = await prisma.item.findMany({
        where: {
            id: { notIn: excludedIds.length > 0 ? excludedIds : [""] },
        },
    });

    if (availableItems.length === 0) return;

    // Shuffle and pick
    const shuffled = availableItems.sort(() => Math.random() - 0.5);
    const toList = shuffled.slice(0, needed);

    for (const item of toList) {
        const minBid = randomMinBid(item.internalValue);
        const duration = randomDuration();
        const endsAt = new Date(Date.now() + duration);

        await prisma.auction.create({
            data: {
                itemId: item.id,
                minBid,
                currentBid: minBid,
                endsAt,
                listedBy: "system",
                status: "active",
            },
        });
    }
}

export async function expireAuctions() {
    await prisma.auction.updateMany({
        where: {
            status: "active",
            endsAt: { lte: new Date() },
        },
        data: { status: "ended" },
    });
}

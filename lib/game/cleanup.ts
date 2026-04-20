import type { PrismaClient } from "@prisma/client";

const CLEANUP_KEY = "last_cleanup";
const CLEANUP_BATCH_SIZE = 100;

/**
 * Atomically checks whether this caller should run cleanup.
 * Uses a PostgreSQL-level atomic UPDATE ... WHERE updatedAt < threshold to
 * ensure only one concurrent caller wins the check.
 *
 * Returns true if cleanup should proceed, false if another worker already ran
 * it within the threshold window.
 */
export async function shouldRunCleanup(prisma: PrismaClient, thresholdMinutes = 15): Promise<boolean> {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    // Ensure the sentinel row exists without touching updatedAt if it's fresh.
    await prisma.keyValue.upsert({
        where: { key: CLEANUP_KEY },
        create: { key: CLEANUP_KEY, value: new Date(0).toISOString() },
        update: {},
    });

    // Atomically claim ownership: only succeeds if updatedAt is older than the
    // threshold. The @updatedAt field is set to now() by Prisma on every write,
    // so a concurrent caller will see count=0 after this succeeds.
    const result = await prisma.keyValue.updateMany({
        where: {
            key: CLEANUP_KEY,
            updatedAt: { lt: threshold },
        },
        data: { value: new Date().toISOString() },
    });

    return result.count > 0;
}

export interface CleanupResult {
    reservationsDeleted: number;
    bidsDeleted: number;
    auctionsDeleted: number;
}

/**
 * Deletes stale DB records older than `cutoffMinutes` minutes:
 *   - BidReservations belonging to non-active auctions (all statuses)
 *   - Bids belonging to those same auctions
 *   - Non-active Auctions themselves
 *
 * Runs inside a transaction to avoid partial state.
 */
export async function cleanupStaleData(prisma: PrismaClient, cutoffMinutes = 20): Promise<CleanupResult> {
    const cutoff = new Date(Date.now() - cutoffMinutes * 60 * 1000);

    const staleAuctionFilter = {
        createdAt: { lt: cutoff },
        status: { not: "active" as const },
    };

    let reservationsDeleted = 0;
    let bidsDeleted = 0;
    let auctionsDeleted = 0;

    while (true) {
        const staleAuctionIds = await prisma.auction.findMany({
            where: staleAuctionFilter,
            select: { id: true },
            orderBy: { createdAt: "asc" },
            take: CLEANUP_BATCH_SIZE,
        });

        if (staleAuctionIds.length === 0) {
            break;
        }

        const auctionIds = staleAuctionIds.map((auction) => auction.id);

        const [deletedReservations, , deletedBids, deletedAuctions] = await prisma.$transaction([
            prisma.bidReservation.deleteMany({
                where: { auctionId: { in: auctionIds } },
            }),
            prisma.auction.updateMany({
                where: { id: { in: auctionIds } },
                data: { leadingBidId: null, winningBidId: null },
            }),
            prisma.bid.deleteMany({
                where: { auctionId: { in: auctionIds } },
            }),
            prisma.auction.deleteMany({
                where: { id: { in: auctionIds } },
            }),
        ]);

        reservationsDeleted += deletedReservations.count;
        bidsDeleted += deletedBids.count;
        auctionsDeleted += deletedAuctions.count;
    }

    return {
        reservationsDeleted,
        bidsDeleted,
        auctionsDeleted,
    };
}

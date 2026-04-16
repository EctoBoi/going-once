import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { createListing, placeBid, reconcileAuctionLifecycle, resetAuctionStateForTesting } from "@/lib/game/auctionLifecycle";
import { ITEM_TEMPLATES } from "@/lib/game/items";
import { NPC_PERSONAS } from "@/lib/game/npcPersonas";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const pool = new Pool({
    connectionString: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function seedReferenceData() {
    for (const item of ITEM_TEMPLATES) {
        await prisma.item.upsert({
            where: { name: item.name },
            update: { category: item.category, internalValue: item.internalValue },
            create: item,
        });
    }

    for (const persona of NPC_PERSONAS) {
        await prisma.nPCPersona.upsert({
            where: { name: persona.name },
            update: { aggressionSeed: persona.aggressionSeed },
            create: persona,
        });
    }
}

async function seedPlayers() {
    await prisma.player.upsert({
        where: { id: "smoke-seller" },
        update: { wallet: 100, isDiving: false },
        create: { id: "smoke-seller", wallet: 100, isDiving: false },
    });
    await prisma.player.upsert({
        where: { id: "smoke-buyer-a" },
        update: { wallet: 500, isDiving: false },
        create: { id: "smoke-buyer-a", wallet: 500, isDiving: false },
    });
    await prisma.player.upsert({
        where: { id: "smoke-buyer-b" },
        update: { wallet: 500, isDiving: false },
        create: { id: "smoke-buyer-b", wallet: 500, isDiving: false },
    });
}

async function seedInventory() {
    const item = await prisma.item.findFirst({ orderBy: { name: "asc" } });
    assert(item, "Expected seeded items");

    const existing = await prisma.playerItem.findFirst({
        where: { playerId: "smoke-seller", itemId: item.id },
    });

    if (existing) {
        await prisma.playerItem.update({
            where: { id: existing.id },
            data: { listedAt: null, acquiredFor: 20 },
        });
        return existing.id;
    }

    const playerItem = await prisma.playerItem.create({
        data: {
            playerId: "smoke-seller",
            itemId: item.id,
            acquiredFor: 20,
        },
    });

    return playerItem.id;
}

async function runSmokeFlow() {
    console.log("Running smoke flow...");
    const playerItemId = await seedInventory();

    const listing = await createListing({
        playerId: "smoke-seller",
        playerItemId,
        minBid: 25,
        durationMinutes: 1,
    });

    const listedItem = await prisma.playerItem.findUnique({ where: { id: playerItemId } });
    assert(listedItem?.listedAt, "Expected listedAt to be set after listing creation");

    const bidResult = await placeBid({
        auctionId: listing.id,
        amount: 30,
        bidderName: "Buyer A",
        isNPC: false,
        playerId: "smoke-buyer-a",
    });

    assert(bidResult.wallet === 470, `Expected buyer A wallet to be 470 after reservation, got ${bidResult.wallet}`);

    await prisma.auction.update({
        where: { id: listing.id },
        data: { endsAt: new Date(Date.now() - 5_000) },
    });

    await reconcileAuctionLifecycle();

    const resolvedAuction = await prisma.auction.findUnique({ where: { id: listing.id } });
    assert(resolvedAuction?.status === "resolved", "Expected listing to resolve");

    const transferredItem = await prisma.playerItem.findUnique({ where: { id: playerItemId } });
    assert(transferredItem?.playerId === "smoke-buyer-a", "Expected buyer A to own the transferred item");
    assert(transferredItem?.listedAt === null, "Expected transferred item to no longer be listed");

    const consumedReservation = await prisma.bidReservation.findFirst({
        where: { auctionId: listing.id, playerId: "smoke-buyer-a", status: "consumed" },
    });
    assert(consumedReservation, "Expected winning reservation to be consumed");

    console.log("Smoke flow passed");
}

async function runConcurrencyChecks() {
    console.log("Running concurrency checks...");
    const item = await prisma.item.findFirst({ orderBy: { name: "asc" } });
    assert(item, "Expected seeded items");

    const concurrentItem = await prisma.playerItem.create({
        data: {
            playerId: "smoke-seller",
            itemId: item.id,
            acquiredFor: 22,
        },
    });

    const listingResults = await Promise.allSettled([
        createListing({
            playerId: "smoke-seller",
            playerItemId: concurrentItem.id,
            minBid: 40,
            durationMinutes: 1,
        }),
        createListing({
            playerId: "smoke-seller",
            playerItemId: concurrentItem.id,
            minBid: 41,
            durationMinutes: 1,
        }),
    ]);

    const successfulListings = listingResults.filter((result) => result.status === "fulfilled");
    assert(successfulListings.length === 1, `Expected exactly one concurrent listing to succeed, got ${successfulListings.length}`);

    const auctionId = successfulListings[0].status === "fulfilled" ? successfulListings[0].value.id : undefined;
    assert(auctionId, "Expected a created auction from the concurrent listing test");

    const bidResults = await Promise.allSettled([
        placeBid({
            auctionId,
            amount: 45,
            bidderName: "Buyer A",
            isNPC: false,
            playerId: "smoke-buyer-a",
        }),
        placeBid({
            auctionId,
            amount: 50,
            bidderName: "Buyer B",
            isNPC: false,
            playerId: "smoke-buyer-b",
        }),
    ]);

    const successfulBids = bidResults.filter((result) => result.status === "fulfilled");
    assert(successfulBids.length >= 1, "Expected at least one concurrent bid to succeed");

    const activeReservations = await prisma.bidReservation.findMany({
        where: { auctionId, status: "active" },
    });
    assert(activeReservations.length === 1, `Expected exactly one active reservation, got ${activeReservations.length}`);

    await prisma.auction.update({
        where: { id: auctionId },
        data: { endsAt: new Date(Date.now() - 5_000) },
    });

    await Promise.all([reconcileAuctionLifecycle(), reconcileAuctionLifecycle()]);

    const resolvedAuction = await prisma.auction.findUnique({ where: { id: auctionId } });
    assert(resolvedAuction?.status === "resolved", "Expected concurrent reconciliation to resolve the auction once");

    const consumedReservations = await prisma.bidReservation.count({
        where: { auctionId, status: "consumed" },
    });
    assert(consumedReservations === 1, `Expected exactly one consumed reservation, got ${consumedReservations}`);

    console.log("Concurrency checks passed");
}

async function main() {
    await seedReferenceData();
    await resetAuctionStateForTesting();
    await seedPlayers();
    await runSmokeFlow();
    await runConcurrencyChecks();
    console.log("Auction lifecycle validation complete");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });

import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ITEM_TEMPLATES } from "../lib/game/items";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const connectionString = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("Missing MIGRATE_DATABASE_URL or DATABASE_URL");
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Resetting items and dependent records...");

    const result = await prisma.$transaction(async (tx) => {
        const countsBefore = {
            bidReservations: await tx.bidReservation.count(),
            bids: await tx.bid.count(),
            auctions: await tx.auction.count(),
            playerItems: await tx.playerItem.count(),
            items: await tx.item.count(),
        };

        await tx.bidReservation.deleteMany();
        await tx.auction.updateMany({
            data: {
                leadingBidId: null,
                leadingPlayerId: null,
                winningBidId: null,
                winningPlayerId: null,
            },
        });
        await tx.bid.deleteMany();
        await tx.auction.deleteMany();
        await tx.playerItem.deleteMany();
        await tx.item.deleteMany();

        await tx.item.createMany({
            data: ITEM_TEMPLATES.map((item) => ({
                name: item.name,
                description: item.description,
                category: item.category,
                internalValue: item.internalValue,
            })),
        });

        return {
            countsBefore,
            itemCountAfter: await tx.item.count(),
        };
    });

    console.log("Deleted counts:", result.countsBefore);
    console.log(`Reseeded ${result.itemCountAfter} items.`);
}

main()
    .catch((error) => {
        console.error("Failed to reseed items:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
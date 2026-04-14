import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ITEM_TEMPLATES } from "../lib/game/items";
import { NPC_PERSONAS } from "../lib/game/npcPersonas";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding items...");
    for (const item of ITEM_TEMPLATES) {
        await prisma.item.upsert({
            where: { name: item.name },
            update: { internalValue: item.internalValue, category: item.category },
            create: item,
        });
    }
    console.log(`Seeded ${ITEM_TEMPLATES.length} items`);

    console.log("Seeding NPC personas...");
    for (const persona of NPC_PERSONAS) {
        await prisma.nPCPersona.upsert({
            where: { name: persona.name },
            update: { aggressionSeed: persona.aggressionSeed },
            create: persona,
        });
    }
    console.log(`Seeded ${NPC_PERSONAS.length} NPC personas`);
}

main()
    .catch(console.error)
    .finally(() => pool.end());

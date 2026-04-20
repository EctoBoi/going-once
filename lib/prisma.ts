import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
    pgPool: Pool | undefined;
    prismaAdapter: PrismaPg | undefined;
    prisma: PrismaClient | undefined;
};

const pool =
    globalForPrisma.pgPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL!,
        ssl: { rejectUnauthorized: false },
    });

const adapter = globalForPrisma.prismaAdapter ?? new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
    globalForPrisma.prismaAdapter = adapter;
    globalForPrisma.prisma = prisma;
}

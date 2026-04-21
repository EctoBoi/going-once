-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "hostIsNPC" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hostName" TEXT;

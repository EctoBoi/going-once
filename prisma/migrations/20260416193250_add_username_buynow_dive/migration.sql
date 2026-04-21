/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Player` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "buyNow" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "diveFinishesAt" TIMESTAMP(3),
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

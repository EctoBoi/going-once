-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('active', 'resolving', 'resolved');

-- CreateEnum
CREATE TYPE "BidReservationStatus" AS ENUM ('active', 'released', 'consumed', 'expired', 'voided');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "internalValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "playerItemId" TEXT,
    "minBid" DOUBLE PRECISION NOT NULL,
    "currentBid" DOUBLE PRECISION NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listedBy" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'active',
    "resolvingAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "leadingBidId" TEXT,
    "leadingPlayerId" TEXT,
    "winningBidId" TEXT,
    "winningPlayerId" TEXT,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isNPC" BOOLEAN NOT NULL,
    "playerId" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "wallet" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "isDiving" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerItem" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "acquiredFor" DOUBLE PRECISION NOT NULL,
    "listedAt" TIMESTAMP(3),

    CONSTRAINT "PlayerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NPCPersona" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aggressionSeed" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "NPCPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidReservation" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "bidId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "BidReservationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "BidReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "Item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_leadingBidId_key" ON "Auction"("leadingBidId");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_winningBidId_key" ON "Auction"("winningBidId");

-- CreateIndex
CREATE INDEX "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Auction_playerItemId_status_idx" ON "Auction"("playerItemId", "status");

-- CreateIndex
CREATE INDEX "Auction_itemId_status_idx" ON "Auction"("itemId", "status");

-- CreateIndex
CREATE INDEX "Bid_auctionId_placedAt_idx" ON "Bid"("auctionId", "placedAt");

-- CreateIndex
CREATE INDEX "Bid_auctionId_amount_idx" ON "Bid"("auctionId", "amount");

-- CreateIndex
CREATE UNIQUE INDEX "NPCPersona_name_key" ON "NPCPersona"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BidReservation_bidId_key" ON "BidReservation"("bidId");

-- CreateIndex
CREATE INDEX "BidReservation_auctionId_status_idx" ON "BidReservation"("auctionId", "status");

-- CreateIndex
CREATE INDEX "BidReservation_playerId_status_idx" ON "BidReservation"("playerId", "status");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_playerItemId_fkey" FOREIGN KEY ("playerItemId") REFERENCES "PlayerItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_leadingBidId_fkey" FOREIGN KEY ("leadingBidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_leadingPlayerId_fkey" FOREIGN KEY ("leadingPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winningPlayerId_fkey" FOREIGN KEY ("winningPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerItem" ADD CONSTRAINT "PlayerItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerItem" ADD CONSTRAINT "PlayerItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidReservation" ADD CONSTRAINT "BidReservation_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidReservation" ADD CONSTRAINT "BidReservation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidReservation" ADD CONSTRAINT "BidReservation_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

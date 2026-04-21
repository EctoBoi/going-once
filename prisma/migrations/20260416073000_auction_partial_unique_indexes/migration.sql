CREATE UNIQUE INDEX "Auction_open_playerItemId_unique"
ON "Auction" ("playerItemId")
WHERE "playerItemId" IS NOT NULL AND "status" IN ('active', 'resolving');

CREATE UNIQUE INDEX "Auction_open_system_item_unique"
ON "Auction" ("itemId")
WHERE "listedBy" = 'system' AND "status" IN ('active', 'resolving');

CREATE UNIQUE INDEX "BidReservation_active_auction_unique"
ON "BidReservation" ("auctionId")
WHERE "status" = 'active';
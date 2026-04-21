-- DropForeignKey
ALTER TABLE "PlayerItem" DROP CONSTRAINT "PlayerItem_playerId_fkey";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "guestExpiresAt" TIMESTAMP(3),
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "KeyValue" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyValue_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "PlayerItem" ADD CONSTRAINT "PlayerItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

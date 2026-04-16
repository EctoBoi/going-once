import { reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";

export async function resolveEndedAuctions() {
    await reconcileAuctionLifecycle();
}

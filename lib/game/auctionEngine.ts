import { reconcileAuctionLifecycle } from "@/lib/game/auctionLifecycle";

export async function replenishAuctions() {
    await reconcileAuctionLifecycle();
}

export async function expireAuctions() {
    await reconcileAuctionLifecycle();
}

import { AuctionStatus, BidReservationStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { NPC_PERSONAS } from "@/lib/game/npcPersonas";
import { roundDownOnePlaceOver, formatMoney } from "@/lib/game/priceUtils";

const TARGET_ACTIVE_SYSTEM_AUCTIONS = 12;
const STALE_RESOLVING_TIMEOUT_MS = 60_000;
const OPEN_AUCTION_STATUSES: AuctionStatus[] = [AuctionStatus.active, AuctionStatus.resolving];

export class AuctionLifecycleError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly code: string,
    ) {
        super(message);
        this.name = "AuctionLifecycleError";
    }
}

type PlaceBidInput = {
    auctionId: string;
    amount: number;
    bidderName: string;
    isNPC: boolean;
    playerId?: string;
    now?: Date;
};

function randomNPCHost() {
    return NPC_PERSONAS[Math.floor(Math.random() * NPC_PERSONAS.length)];
}

function randomBuyNow(internalValue: number): number {
    // [-5%, +20%] of internal value, then round down to one place-over rule
    const factor = 0.95 + Math.random() * 0.25;
    const raw = internalValue * factor;
    return roundDownOnePlaceOver(raw);
}

type CreateListingInput = {
    playerId: string;
    playerItemId: string;
    minBid: number;
    buyNow?: number;
    durationMinutes: number;
    now?: Date;
};

function isRetryableTransactionError(error: unknown) {
    // Handle known Prisma client serialization error codes as well as
    // lower-level driver errors (e.g. Postgres SQLSTATE 40001).
    // Narrow the error shape instead of using `any` so TypeScript stays strict.
    const errWithCause = error as { cause?: { originalCode?: string | number } };

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return true;
    }

    // Prisma may wrap driver errors in a DriverAdapterError whose `cause`
    // contains the original SQLSTATE code (e.g. '40001' for serialization failures).
    if (errWithCause?.cause?.originalCode === "40001" || errWithCause?.cause?.originalCode === 40001) {
        return true;
    }

    // Postgres reports deadlocks with SQLSTATE '40P01' (deadlock_detected).
    // Treat these as retryable as well to avoid permanent failures when
    // concurrent transactions contend for the same rows.
    if (errWithCause?.cause?.originalCode === "40P01") {
        return true;
    }

    // Some driver wrappers include the underlying message rather than a code.
    const errLike = error as { message?: unknown; cause?: { message?: unknown } } | undefined;
    const message =
        errLike && typeof errLike.message === "string" ? errLike.message : errLike && errLike.message !== undefined ? String(errLike.message) : undefined;
    const causeMessage =
        errLike && errLike.cause && typeof errLike.cause.message === "string"
            ? errLike.cause.message
            : errLike && errLike.cause && errLike.cause.message !== undefined
              ? String(errLike.cause.message)
              : undefined;
    const errStr = (message ?? causeMessage ?? "").toLowerCase();
    if (errStr.includes("deadlock")) {
        return true;
    }

    return false;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withSerializableTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>, maxRetries = 5): Promise<T> {
    let attempt = 0;

    while (true) {
        try {
            return await prisma.$transaction(callback, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (error) {
            attempt += 1;
            if (!isRetryableTransactionError(error) || attempt >= maxRetries) {
                throw error;
            }

            // Exponential backoff with jitter to reduce contention between concurrent transactions
            const base = 50; // ms
            const backoff = Math.min(1000, base * 2 ** (attempt - 1));
            const jitter = Math.floor(Math.random() * base);
            await sleep(backoff + jitter);
        }
    }
}

function randomDuration() {
    const min = 1 * 60 * 1000;
    const max = 3 * 60 * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomMinBid(internalValue: number) {
    const factor = 0.2 + Math.random() * 0.2;
    const raw = internalValue * factor;
    return roundDownOnePlaceOver(raw);
}

async function releaseReservation(
    tx: Prisma.TransactionClient,
    reservation: { id: string; playerId: string; amount: number },
    now: Date,
    status: BidReservationStatus,
    reason: string,
) {
    await tx.player.update({
        where: { id: reservation.playerId },
        data: { wallet: { increment: reservation.amount } },
    });

    await tx.bidReservation.update({
        where: { id: reservation.id },
        data: {
            status,
            releasedAt: now,
            reason,
        },
    });
}

async function consumeReservation(tx: Prisma.TransactionClient, reservationId: string, now: Date) {
    await tx.bidReservation.update({
        where: { id: reservationId },
        data: {
            status: BidReservationStatus.consumed,
            consumedAt: now,
            reason: "auction_resolved",
        },
    });
}

async function recoverStaleAuctionState(now: Date) {
    const staleThreshold = new Date(now.getTime() - STALE_RESOLVING_TIMEOUT_MS);

    await prisma.auction.updateMany({
        where: {
            status: AuctionStatus.resolving,
            resolvingAt: { lt: staleThreshold },
            resolvedAt: null,
        },
        data: {
            status: AuctionStatus.active,
            resolvingAt: null,
        },
    });

    await prisma.bidReservation.updateMany({
        where: {
            status: BidReservationStatus.active,
            auction: {
                status: AuctionStatus.resolved,
            },
        },
        data: {
            status: BidReservationStatus.voided,
            releasedAt: now,
            reason: "resolved_auction_cleanup",
        },
    });
}

async function settleClaimedAuction(auctionId: string, now: Date) {
    await withSerializableTransaction(async (tx) => {
        const auction = await tx.auction.findUnique({
            where: { id: auctionId },
            include: {
                bids: {
                    orderBy: [{ amount: "desc" }, { placedAt: "desc" }],
                    take: 1,
                },
                reservations: {
                    where: { status: BidReservationStatus.active },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });

        if (!auction || auction.status !== AuctionStatus.resolving) {
            return;
        }

        const leadingBid = auction.leadingBidId ? await tx.bid.findUnique({ where: { id: auction.leadingBidId } }) : (auction.bids[0] ?? null);
        const activeReservation = auction.reservations[0] ?? null;

        const finalizeAuction: Prisma.AuctionUpdateInput = {
            status: AuctionStatus.resolved,
            resolvingAt: null,
            resolvedAt: now,
            winningBid: leadingBid ? { connect: { id: leadingBid.id } } : { disconnect: true },
            winningPlayer: leadingBid?.playerId ? { connect: { id: leadingBid.playerId } } : { disconnect: true },
            leadingBid: leadingBid ? { connect: { id: leadingBid.id } } : { disconnect: true },
            leadingPlayer: leadingBid?.playerId ? { connect: { id: leadingBid.playerId } } : { disconnect: true },
        };

        if (!leadingBid) {
            if (activeReservation) {
                await releaseReservation(tx, activeReservation, now, BidReservationStatus.voided, "auction_resolved_without_leader");
            }

            if (auction.playerItemId) {
                await tx.playerItem.update({
                    where: { id: auction.playerItemId },
                    data: { listedAt: null },
                });
            }

            await tx.auction.update({
                where: { id: auction.id },
                data: finalizeAuction,
            });
            return;
        }

        if (leadingBid.playerId && !activeReservation) {
            throw new AuctionLifecycleError("Winning player bid is missing an active reservation", 409, "missing_active_reservation");
        }

        if (auction.playerItemId) {
            if (leadingBid.playerId && activeReservation) {
                await consumeReservation(tx, activeReservation.id, now);
                await tx.player.update({
                    where: { id: auction.listedBy },
                    data: { wallet: { increment: leadingBid.amount } },
                });
                await tx.playerItem.update({
                    where: { id: auction.playerItemId },
                    data: {
                        playerId: leadingBid.playerId,
                        acquiredFor: leadingBid.amount,
                        listedAt: null,
                    },
                });
            } else if (!leadingBid.playerId) {
                if (activeReservation) {
                    await releaseReservation(tx, activeReservation, now, BidReservationStatus.voided, "npc_won_auction_cleanup");
                }
                await tx.player.update({
                    where: { id: auction.listedBy },
                    data: { wallet: { increment: leadingBid.amount } },
                });
                await tx.playerItem.delete({
                    where: { id: auction.playerItemId },
                });
            }

            await tx.auction.update({
                where: { id: auction.id },
                data: finalizeAuction,
            });
            return;
        }

        if (leadingBid.playerId && activeReservation) {
            await consumeReservation(tx, activeReservation.id, now);
            await tx.playerItem.create({
                data: {
                    playerId: leadingBid.playerId,
                    itemId: auction.itemId,
                    acquiredFor: leadingBid.amount,
                },
            });
        } else if (activeReservation) {
            await releaseReservation(tx, activeReservation, now, BidReservationStatus.voided, "system_auction_cleanup");
        }

        await tx.auction.update({
            where: { id: auction.id },
            data: finalizeAuction,
        });
    });
}

async function claimAndResolveAuction(auctionId: string, now: Date) {
    const claimed = await prisma.auction.updateMany({
        where: {
            id: auctionId,
            status: AuctionStatus.active,
            endsAt: { lte: now },
        },
        data: {
            status: AuctionStatus.resolving,
            resolvingAt: now,
        },
    });

    if (claimed.count === 0) {
        return false;
    }

    await settleClaimedAuction(auctionId, now);
    return true;
}

async function replenishSystemAuctions(now: Date) {
    await withSerializableTransaction(async (tx) => {
        const activeSystemCount = await tx.auction.count({
            where: {
                listedBy: "system",
                status: { in: OPEN_AUCTION_STATUSES },
            },
        });

        const needed = TARGET_ACTIVE_SYSTEM_AUCTIONS - activeSystemCount;
        if (needed <= 0) {
            return;
        }

        const excludedIds = await tx.auction.findMany({
            where: {
                status: { in: OPEN_AUCTION_STATUSES },
            },
            select: { itemId: true },
        });

        const availableItems = await tx.item.findMany({
            where: {
                id: {
                    notIn: excludedIds.length > 0 ? excludedIds.map((auction) => auction.itemId) : undefined,
                },
            },
        });

        if (availableItems.length === 0) {
            return;
        }

        const shuffled = [...availableItems].sort(() => Math.random() - 0.5);
        const toList = shuffled.slice(0, needed);

        for (const item of toList) {
            const existingAuction = await tx.auction.findFirst({
                where: {
                    itemId: item.id,
                    listedBy: "system",
                    status: { in: OPEN_AUCTION_STATUSES },
                },
            });

            if (existingAuction) {
                continue;
            }

            const minBid = randomMinBid(item.internalValue);
            const endsAt = new Date(now.getTime() + randomDuration());
            const npc = randomNPCHost();
            const buyNow = randomBuyNow(item.internalValue);

            await tx.auction.create({
                data: {
                    itemId: item.id,
                    minBid,
                    buyNow,
                    currentBid: minBid,
                    endsAt,
                    listedBy: "system",
                    hostName: npc.name,
                    hostIsNPC: true,
                    status: AuctionStatus.active,
                },
            });
        }
    });
}

export async function reconcileAuctionLifecycle(now = new Date()) {
    await recoverStaleAuctionState(now);

    const endedAuctions = await prisma.auction.findMany({
        where: {
            status: AuctionStatus.active,
            endsAt: { lte: now },
        },
        select: { id: true },
        orderBy: { endsAt: "asc" },
    });

    for (const auction of endedAuctions) {
        await claimAndResolveAuction(auction.id, now);
    }

    await replenishSystemAuctions(now);
}

export async function placeBid(input: PlaceBidInput) {
    const now = input.now ?? new Date();

    return withSerializableTransaction(async (tx) => {
        const auction = await tx.auction.findUnique({
            where: { id: input.auctionId },
            include: {
                reservations: {
                    where: { status: BidReservationStatus.active },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });

        if (!auction) {
            throw new AuctionLifecycleError("Auction not found", 404, "auction_not_found");
        }
        if (auction.status !== AuctionStatus.active || now > auction.endsAt) {
            throw new AuctionLifecycleError("Auction has ended", 400, "auction_not_active");
        }
        if (input.amount <= auction.currentBid) {
            throw new AuctionLifecycleError(`Bid must be higher than $${formatMoney(auction.currentBid)}`, 400, "bid_too_low");
        }
        if (!input.isNPC && !input.playerId) {
            throw new AuctionLifecycleError("Player bids require a player id", 500, "missing_player_id");
        }
        // Prevent the auction host from bidding on their own listing
        if (!input.isNPC && input.playerId && auction.listedBy === input.playerId) {
            throw new AuctionLifecycleError("You cannot bid on your own auction", 403, "self_bid_forbidden");
        }
        // Prevent an NPC host from bidding on their own NPC-hosted listing
        if (input.isNPC && auction.hostIsNPC && auction.hostName && auction.hostName === input.bidderName) {
            throw new AuctionLifecycleError("NPCs cannot bid on their own auction", 403, "self_bid_forbidden");
        }

        const activeReservation = auction.reservations[0] ?? null;

        let updatedWallet: number | undefined;
        if (!input.isNPC && input.playerId) {
            const player = await tx.player.findUnique({ where: { id: input.playerId } });
            if (!player) {
                throw new AuctionLifecycleError("Player not found", 404, "player_not_found");
            }

            const reclaimableAmount = activeReservation?.playerId === input.playerId ? activeReservation.amount : 0;
            if (player.wallet + reclaimableAmount < input.amount) {
                throw new AuctionLifecycleError("Insufficient funds", 400, "insufficient_funds");
            }
        }

        if (activeReservation) {
            await releaseReservation(tx, activeReservation, now, BidReservationStatus.released, "outbid");
        }

        if (auction.leadingBidId) {
            await tx.bid.update({
                where: { id: auction.leadingBidId },
                data: { supersededAt: now },
            });
        }

        const bid = await tx.bid.create({
            data: {
                auctionId: auction.id,
                bidderName: input.bidderName,
                amount: input.amount,
                isNPC: input.isNPC,
                playerId: input.playerId ?? null,
                placedAt: now,
            },
        });

        if (!input.isNPC && input.playerId) {
            const player = await tx.player.update({
                where: { id: input.playerId },
                data: { wallet: { decrement: input.amount } },
            });

            updatedWallet = player.wallet;

            const reservation = await tx.bidReservation.create({
                data: {
                    auctionId: auction.id,
                    playerId: input.playerId,
                    bidId: bid.id,
                    amount: input.amount,
                    status: BidReservationStatus.active,
                    expiresAt: auction.endsAt,
                    reason: "leading_bid",
                },
            });

            await tx.bid.update({
                where: { id: bid.id },
                data: { reservation: { connect: { id: reservation.id } } },
            });
        }

        await tx.auction.update({
            where: { id: auction.id },
            data: {
                currentBid: input.amount,
                leadingBidId: bid.id,
                leadingPlayerId: input.playerId ?? null,
            },
        });

        return {
            bid,
            currentBid: input.amount,
            wallet: updatedWallet,
        };
    });
}

export async function createListing(input: CreateListingInput) {
    const now = input.now ?? new Date();
    const endsAt = new Date(now.getTime() + input.durationMinutes * 60 * 1000);

    return withSerializableTransaction(async (tx) => {
        const playerItem = await tx.playerItem.findUnique({
            where: { id: input.playerItemId },
        });

        if (!playerItem) {
            throw new AuctionLifecycleError("Item not found", 404, "item_not_found");
        }
        if (playerItem.playerId !== input.playerId) {
            throw new AuctionLifecycleError("Unauthorized", 401, "item_not_owned");
        }

        // Prevent players from listing items while they are mid-dive.
        const player = await tx.player.findUnique({ where: { id: input.playerId } });
        if (!player) {
            throw new AuctionLifecycleError("Player not found", 404, "player_not_found");
        }
        if (player.isDiving) {
            throw new AuctionLifecycleError("Cannot list items while diving", 403, "player_diving");
        }

        const marked = await tx.playerItem.updateMany({
            where: {
                id: input.playerItemId,
                playerId: input.playerId,
                listedAt: null,
            },
            data: { listedAt: now },
        });

        if (marked.count === 0) {
            throw new AuctionLifecycleError("Already listed", 400, "item_already_listed");
        }

        const existingAuction = await tx.auction.findFirst({
            where: {
                playerItemId: input.playerItemId,
                status: { in: OPEN_AUCTION_STATUSES },
            },
        });

        if (existingAuction) {
            throw new AuctionLifecycleError("Already listed", 400, "existing_open_auction");
        }

        if (input.buyNow !== undefined && input.buyNow < 0) {
            throw new AuctionLifecycleError("Buy-now price cannot be negative", 400, "invalid_buy_now");
        }

        return tx.auction.create({
            data: {
                itemId: playerItem.itemId,
                playerItemId: playerItem.id,
                minBid: input.minBid,
                buyNow: input.buyNow ?? null,
                currentBid: input.minBid,
                endsAt,
                listedBy: input.playerId,
                hostName: player.username ?? `Player-${input.playerId.slice(0, 6)}`,
                hostIsNPC: false,
                status: AuctionStatus.active,
            },
        });
    });
}

/**
 * Execute a buy-now on an auction. Supports both NPC and player buyers.
 * The auction is immediately settled at the buyNow price.
 */
export async function executeBuyNow(input: { auctionId: string; bidderName: string; playerId?: string; isPlayer?: boolean }) {
    const now = new Date();

    await withSerializableTransaction(async (tx) => {
        const auction = await tx.auction.findUnique({
            where: { id: input.auctionId },
            include: {
                reservations: {
                    where: { status: BidReservationStatus.active },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });

        if (!auction || !auction.buyNow) {
            throw new AuctionLifecycleError("No buy-now price set", 400, "no_buy_now");
        }
        if (auction.status !== AuctionStatus.active || now > auction.endsAt) {
            throw new AuctionLifecycleError("Auction has ended", 400, "auction_not_active");
        }
        if (auction.buyNow <= auction.currentBid) {
            throw new AuctionLifecycleError("Buy-now price already exceeded by current bid", 400, "buy_now_exceeded");
        }
        // Prevent the host from buying out their own listing
        if (input.isPlayer && input.playerId && auction.listedBy === input.playerId) {
            throw new AuctionLifecycleError("You cannot buy your own listing", 403, "self_buy_forbidden");
        }
        // Prevent an NPC host from buy-now'ing their own NPC-hosted listing
        if (!input.isPlayer && auction.hostIsNPC && auction.hostName && auction.hostName === input.bidderName) {
            throw new AuctionLifecycleError("NPCs cannot buy their own listing", 403, "self_buy_forbidden");
        }

        const isNPCBuyer = !input.isPlayer;

        if (input.isPlayer && input.playerId) {
            const buyer = await tx.player.findUnique({ where: { id: input.playerId } });
            if (!buyer) {
                throw new AuctionLifecycleError("Player not found", 404, "player_not_found");
            }
            if (buyer.wallet < auction.buyNow) {
                throw new AuctionLifecycleError("Insufficient funds", 400, "insufficient_funds");
            }
        }

        const activeReservation = auction.reservations[0] ?? null;
        if (activeReservation) {
            await releaseReservation(tx, activeReservation, now, BidReservationStatus.released, "outbid_by_buy_now");
        }

        if (auction.leadingBidId) {
            await tx.bid.update({
                where: { id: auction.leadingBidId },
                data: { supersededAt: now },
            });
        }

        const bid = await tx.bid.create({
            data: {
                auctionId: auction.id,
                bidderName: input.bidderName,
                amount: auction.buyNow,
                isNPC: isNPCBuyer,
                playerId: input.playerId ?? null,
                placedAt: now,
            },
        });

        if (input.isPlayer && input.playerId) {
            // Deduct from player wallet; settlement will transfer to seller
            await tx.player.update({
                where: { id: input.playerId },
                data: { wallet: { decrement: auction.buyNow } },
            });

            await tx.bidReservation.create({
                data: {
                    auctionId: auction.id,
                    playerId: input.playerId,
                    bidId: bid.id,
                    amount: auction.buyNow,
                    status: BidReservationStatus.active,
                    expiresAt: now,
                    reason: "buy_now",
                },
            });
        }

        // Force auction into resolving state immediately
        await tx.auction.update({
            where: { id: auction.id },
            data: {
                currentBid: auction.buyNow,
                leadingBidId: bid.id,
                leadingPlayerId: input.playerId ?? null,
                endsAt: now,
                status: AuctionStatus.resolving,
                resolvingAt: now,
            },
        });
    });

    await settleClaimedAuction(input.auctionId, now);
}

export async function resetAuctionStateForTesting() {
    await withSerializableTransaction(async (tx) => {
        await tx.bidReservation.deleteMany();
        await tx.bid.deleteMany();
        await tx.auction.deleteMany();
        await tx.playerItem.updateMany({
            where: { listedAt: { not: null } },
            data: { listedAt: null },
        });
    });
}

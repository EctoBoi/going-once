import { prisma } from "@/lib/prisma";
import { AuctionLifecycleError, executeBuyNow, placeBid } from "@/lib/game/auctionLifecycle";
import { roundDownOnePlaceOver } from "@/lib/game/priceUtils";
import { ENABLE_NPC_BUY_NOW, NPC_BASE_LOW_CHANCE, NPC_BUY_BREAKPOINT, NPC_MAX_AGGRESSION_BOOST, NPC_MAX_OVER } from "@/lib/npc/constants";

const NPC_EVALUATION_KEY = "npc_evaluation";
const DEFAULT_NPC_EVALUATION_LEASE_MS = 12_000;
const NPC_SCHEDULED_BID_ATTEMPTS = 6;

function isStatementTimeoutError(error: unknown) {
    const errWithCause = error as { message?: unknown; cause?: { originalCode?: string | number; message?: unknown } };
    const originalCode = errWithCause?.cause?.originalCode;
    if (originalCode === "57014" || originalCode === 57014) {
        return true;
    }

    const message =
        typeof errWithCause?.message === "string"
            ? errWithCause.message
            : errWithCause?.message !== undefined
              ? String(errWithCause.message)
              : typeof errWithCause?.cause?.message === "string"
                ? errWithCause.cause.message
                : errWithCause?.cause?.message !== undefined
                  ? String(errWithCause.cause.message)
                  : "";

    return message.toLowerCase().includes("statement timeout");
}

function isExpectedScheduledBidError(error: unknown) {
    if (error instanceof AuctionLifecycleError) {
        return error.code === "auction_not_active" || error.code === "bid_too_low" || error.code === "self_bid_forbidden";
    }

    return isStatementTimeoutError(error);
}

export async function shouldRunNPCEvaluation(leaseMs = DEFAULT_NPC_EVALUATION_LEASE_MS): Promise<boolean> {
    const threshold = new Date(Date.now() - leaseMs);

    await prisma.keyValue.upsert({
        where: { key: NPC_EVALUATION_KEY },
        create: { key: NPC_EVALUATION_KEY, value: new Date(0).toISOString() },
        update: {},
    });

    const result = await prisma.keyValue.updateMany({
        where: {
            key: NPC_EVALUATION_KEY,
            updatedAt: { lt: threshold },
        },
        data: { value: new Date().toISOString() },
    });

    return result.count > 0;
}

// Probability function
// P(bid) = baseRate * (1 - price/V)^k * (1 - elapsed/duration)^j
// k and j control how steeply interest drops off
const BASE_RATE = 0.85;
const K = 1.6; // price sensitivity
const J = 1.2; // time sensitivity

function calculateBidProbability(currentBid: number, internalValue: number, endsAt: Date, createdAt: Date): number {
    const priceFactor = Math.max(0, 1 - currentBid / internalValue);
    const totalDuration = endsAt.getTime() - createdAt.getTime();
    const elapsed = Date.now() - createdAt.getTime();
    const timeFactor = Math.max(0, 1 - elapsed / totalDuration);

    const probability = BASE_RATE * Math.pow(priceFactor, K) * Math.pow(timeFactor, J);
    return Math.min(1, Math.max(0, probability));
}

/**
 * Compute the probability that an NPC will use buy-now on a player auction.
 *
 * Piecewise linear:
 *  B <= (1-t)*V               → 1.0   (100%)
 *  (1-t)*V < B <= V           → linear 100% → NPC_BASE_LOW_CHANCE
 *  V < B < V*(1+NPC_MAX_OVER) → baseChance linear NPC_BASE_LOW_CHANCE → 0%, plus aggression boost
 *  B >= V*(1+NPC_MAX_OVER)    → 0%
 *
 * Aggression boost only applies in the V < B < 1.25V range:
 *  boost = aggression * NPC_MAX_AGGRESSION_BOOST * (1 - (B-V) / (NPC_MAX_OVER*V))
 */
export function computeBuyNowChance({ buyNow, internalValue, aggression }: { buyNow: number; internalValue: number; aggression: number }): number {
    if (internalValue <= 0) return 0;
    const t = NPC_BUY_BREAKPOINT;
    const lower = (1 - t) * internalValue;
    const upper = (1 + NPC_MAX_OVER) * internalValue;

    if (buyNow <= lower) return 1.0;

    if (buyNow <= internalValue) {
        // linear from 1.0 down to NPC_BASE_LOW_CHANCE
        const fraction = (buyNow - lower) / (t * internalValue);
        return 1.0 - fraction * (1.0 - NPC_BASE_LOW_CHANCE);
    }

    if (buyNow < upper) {
        const fraction = (buyNow - internalValue) / (NPC_MAX_OVER * internalValue);
        const baseChance = NPC_BASE_LOW_CHANCE * (1 - fraction);
        const boost = Math.max(0, Math.min(1, aggression)) * NPC_MAX_AGGRESSION_BOOST * (1 - fraction);
        return Math.max(0, baseChance + boost);
    }

    return 0;
}

// How much an NPC will bid above current — influenced by aggression
function calculateNPCBidAmount(currentBid: number, internalValue: number, aggressionSeed: number): number {
    // Base increment is $1-5
    const baseIncrement = 1 + Math.random() * 4;
    // Aggressive NPCs occasionally bid well above value
    const aggressionMultiplier = Math.random() < aggressionSeed ? 1 + Math.random() * 0.5 : 1;
    const raw = (currentBid + baseIncrement) * aggressionMultiplier;
    return roundDownOnePlaceOver(raw);
}

export async function evaluateNPCBids() {
    const activeAuctions = await prisma.auction.findMany({
        where: { status: "active", endsAt: { gt: new Date() } },
        include: { item: true },
    });

    if (activeAuctions.length === 0) return;

    const personas = await prisma.nPCPersona.findMany();
    if (personas.length === 0) return;

    // Build a map of which NPC personas have already bid on each auction so
    // we can route duplicate-bid attempts to a different (fresh) persona
    // instead of skipping the auction entirely — preserving overall bid volume.
    const existingNPCBids = await prisma.bid.findMany({
        where: { isNPC: true, auctionId: { in: activeAuctions.map((a) => a.id) } },
        select: { auctionId: true, bidderName: true },
    });
    const npcBidsByAuction = new Map<string, Set<string>>();
    for (const bid of existingNPCBids) {
        if (!npcBidsByAuction.has(bid.auctionId)) {
            npcBidsByAuction.set(bid.auctionId, new Set());
        }
        npcBidsByAuction.get(bid.auctionId)!.add(bid.bidderName);
    }

    for (const auction of activeAuctions) {
        // Pick a persona that hasn't already bid on this auction
        const alreadyBidPersonas = npcBidsByAuction.get(auction.id) ?? new Set<string>();
        const availablePersonas = personas.filter(
            (p) => !alreadyBidPersonas.has(p.name) && (!auction.hostIsNPC || !auction.hostName || p.name !== auction.hostName),
        );
        if (availablePersonas.length === 0) continue; // All personas already bid — skip

        const shuffledPersonas = [...availablePersonas].sort(() => Math.random() - 0.5);

        // Perform the probability check per-persona rather than once per-auction.
        // This preserves the overall bid volume but gives each persona an independent chance.
        let plannedCurrentBid = auction.currentBid;
        let attempts = 0;
        let auctionEndedByBuyNow = false;

        for (const scheduledPersona of shuffledPersonas) {
            if (attempts >= NPC_SCHEDULED_BID_ATTEMPTS) break;

            // Per-persona probability roll
            const probability = calculateBidProbability(plannedCurrentBid, auction.item.internalValue, auction.endsAt, auction.createdAt);
            const personaRoll = Math.random();
            if (personaRoll > probability) continue;

            // Buy-now opportunity per persona
            if (ENABLE_NPC_BUY_NOW && auction.playerItemId && auction.buyNow !== null && auction.buyNow !== undefined && auction.buyNow > plannedCurrentBid) {
                const effectiveChance = computeBuyNowChance({
                    buyNow: auction.buyNow,
                    internalValue: auction.item.internalValue,
                    aggression: scheduledPersona.aggressionSeed,
                });
                const drawOutcome = Math.random() < effectiveChance;

                if (drawOutcome) {
                    executeBuyNow({ auctionId: auction.id, bidderName: scheduledPersona.name }).catch((err) => {
                        if (!(err instanceof AuctionLifecycleError)) {
                            console.error("NPC buy-now failed", { auctionId: auction.id, err });
                        }
                    });
                    auctionEndedByBuyNow = true;
                    break;
                }
            }

            const bidAmount = calculateNPCBidAmount(plannedCurrentBid, auction.item.internalValue, scheduledPersona.aggressionSeed);

            // If the computed bid meets or exceeds buyNow, execute buy-now to end the auction immediately
            if (auction.buyNow !== null && auction.buyNow !== undefined && bidAmount >= auction.buyNow && auction.buyNow > plannedCurrentBid) {
                executeBuyNow({ auctionId: auction.id, bidderName: scheduledPersona.name }).catch((err) => {
                    if (!(err instanceof AuctionLifecycleError)) {
                        console.error("NPC buy-now (bid cap) failed", { auctionId: auction.id, err });
                    }
                });
                auctionEndedByBuyNow = true;
                break;
            }

            plannedCurrentBid = Math.max(plannedCurrentBid, bidAmount);
            attempts++;
            scheduleNPCBid(auction.id, scheduledPersona.name, bidAmount, (5 + Math.random() * 20) * 1000).catch((err) => {
                console.error("NPC bid scheduling failed", { auctionId: auction.id, err });
            });
        }

        if (auctionEndedByBuyNow) continue;
    }
}

async function scheduleNPCBid(auctionId: string, personaName: string, amount: number, delayMs: number) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
        // Re-check only the fields needed for a delayed best-effort bid.
        const auction = await prisma.auction.findUnique({
            where: { id: auctionId },
            select: {
                status: true,
                endsAt: true,
                currentBid: true,
            },
        });

        if (!auction || auction.status !== "active" || new Date() > auction.endsAt) return;
        if (amount <= auction.currentBid) return;

        await placeBid({
            auctionId,
            bidderName: personaName,
            amount,
            isNPC: true,
        });
    } catch (error) {
        if (isExpectedScheduledBidError(error)) {
            return;
        }
        throw error;
    }
}

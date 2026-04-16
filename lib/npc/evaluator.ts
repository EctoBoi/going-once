import { prisma } from "@/lib/prisma";
import { AuctionLifecycleError, placeBid } from "@/lib/game/auctionLifecycle";

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

// How much an NPC will bid above current — influenced by aggression
function calculateNPCBidAmount(currentBid: number, internalValue: number, aggressionSeed: number): number {
    // Base increment is $1-5
    const baseIncrement = 1 + Math.random() * 4;
    // Aggressive NPCs occasionally bid well above value
    const aggressionMultiplier = Math.random() < aggressionSeed ? 1 + Math.random() * 0.5 : 1;
    const amount = (currentBid + baseIncrement) * aggressionMultiplier;
    return Math.round(amount * 100) / 100;
}

export async function evaluateNPCBids() {
    const activeAuctions = await prisma.auction.findMany({
        where: { status: "active", endsAt: { gt: new Date() } },
        include: { item: true },
    });

    //console.log(`Evaluating ${activeAuctions.length} active auctions`);

    if (activeAuctions.length === 0) return;

    const personas = await prisma.nPCPersona.findMany();
    if (personas.length === 0) return;

    for (const auction of activeAuctions) {
        const probability = calculateBidProbability(auction.currentBid, auction.item.internalValue, auction.endsAt, auction.createdAt);

        const roll = Math.random();
        /*console.log(
            `Auction ${auction.id} (${auction.item.name}): price=${auction.currentBid}, value=${auction.item.internalValue}, probability=${probability.toFixed(3)}, roll=${roll.toFixed(3)}, bidding=${roll <= probability}`,
        );*/

        if (roll > probability) continue;

        const persona = personas[Math.floor(Math.random() * personas.length)];
        const bidAmount = calculateNPCBidAmount(auction.currentBid, auction.item.internalValue, persona.aggressionSeed);

        //console.log(`NPC ${persona.name} scheduling bid of $${bidAmount} on ${auction.item.name}`);
        // Schedule the bid but attach a catch handler so failures don't become unhandled rejections
        scheduleNPCBid(auction.id, persona.name, bidAmount, (5 + Math.random() * 20) * 1000).catch((err) => {
            console.error("NPC bid scheduling failed", { auctionId: auction.id, err });
        });
    }
}

async function scheduleNPCBid(auctionId: string, personaName: string, amount: number, delayMs: number) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Re-check auction is still active and bid is still valid
    const auction = await prisma.auction.findUnique({
        where: { id: auctionId },
    });

    if (!auction || auction.status !== "active" || new Date() > auction.endsAt) return;
    if (amount <= auction.currentBid) return;

    try {
        await placeBid({
            auctionId,
            bidderName: personaName,
            amount,
            isNPC: true,
        });
    } catch (error) {
        if (error instanceof AuctionLifecycleError) {
            return;
        }
        throw error;
    }
}

export type NpcBuyDecisionLog = {
    auctionId: string;
    itemId: string;
    buyNow: number;
    internalValue: number;
    baseChance: number;
    aggression: number;
    effectiveChance: number;
    drawOutcome: boolean;
    npcPersona: string;
    timestamp: string;
};

export function logNpcBuyDecision(details: NpcBuyDecisionLog) {
    console.log("[NPC_BUY_DECISION]", JSON.stringify(details));
}

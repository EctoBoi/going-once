/** Fraction below internalValue where buy-now chance reaches 100% (0.10 = 10% under) */
export const NPC_BUY_BREAKPOINT = 0.1;

/** Maximum fraction above internalValue where buy-now chance reaches 0% (0.25 = 25% over) */
export const NPC_MAX_OVER = 0.25;

/** Base buy-now chance when buyNow equals internalValue exactly (2%) */
export const NPC_BASE_LOW_CHANCE = 0.02;

/** Maximum aggression buy-now boost at buyNow === internalValue (1%) */
export const NPC_MAX_AGGRESSION_BOOST = 0.01;

/** Set ENABLE_NPC_BUY_NOW=false in env to disable the buy-now feature entirely */
export const ENABLE_NPC_BUY_NOW = true;

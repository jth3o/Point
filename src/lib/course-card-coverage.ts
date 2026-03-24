/**
 * Course-level card coverage: scales ~60-minute lecture targets by fact count.
 * high = memorization-heavy, balanced = default, low = conceptual compression.
 */

export type CardCoverageMode = "high" | "balanced" | "compressed";

/** Baseline ranges for a ~60-minute lecture (before fact-count scaling). */
export const COVERAGE_BASE_60MIN: Record<
  CardCoverageMode,
  { min: number; max: number }
> = {
  /** Memorization-heavy: broad recall */
  high: { min: 60, max: 100 },
  /** Balanced */
  balanced: { min: 40, max: 70 },
  /** Conceptual / compressed */
  compressed: { min: 25, max: 50 },
};

/** Facts treated as a typical ~60 min lecture for scaling (midpoint of balanced range). */
const REF_FACT_COUNT = 55;

const SCHEMA_CARD_CEILING = 150;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Target and bounds for this lecture, given course mode and how many facts exist.
 */
export function computeLectureCardBudget(
  mode: CardCoverageMode,
  factCount: number
): {
  target: number;
  minCards: number;
  maxCards: number;
  scale: number;
} {
  const base = COVERAGE_BASE_60MIN[mode];
  const scale = clamp(factCount / REF_FACT_COUNT, 0.25, 1.35);

  let minCards = Math.round(base.min * scale);
  let maxCards = Math.round(base.max * scale);

  minCards = clamp(minCards, 6, SCHEMA_CARD_CEILING);
  maxCards = clamp(maxCards, minCards, SCHEMA_CARD_CEILING);

  // Cannot meaningfully exceed what facts can support (soft cap).
  const factCap = Math.min(SCHEMA_CARD_CEILING, Math.max(12, factCount * 3));
  maxCards = Math.min(maxCards, factCap);
  minCards = Math.min(minCards, maxCards);

  const target = Math.round((minCards + maxCards) / 2);
  return { target, minCards, maxCards, scale };
}

/**
 * First mini-deck pass: ~10–15 high-yield cards, capped by the full lecture budget.
 */
export function computeMiniDeckBudget(fullBudget: {
  minCards: number;
  maxCards: number;
  target: number;
}): { minCards: number; maxCards: number; target: number } {
  const maxCards = Math.min(15, fullBudget.maxCards);
  const minCards = Math.min(10, maxCards);
  const target = Math.round((minCards + maxCards) / 2);
  return {
    minCards: Math.max(6, Math.min(minCards, maxCards)),
    maxCards,
    target: Math.min(Math.max(target, 6), maxCards),
  };
}

export function parseCardCoverageMode(
  value: unknown,
  fallback: CardCoverageMode = "balanced"
): CardCoverageMode {
  if (value === "high" || value === "balanced" || value === "compressed") {
    return value;
  }
  /** Legacy DB value before rename */
  if (value === "low") return "compressed";
  return fallback;
}

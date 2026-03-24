/**
 * Fact filtering, concept clustering, and prompt-sized selection.
 * Volume is driven by course {@link CardCoverageMode}, not a universal tight cap.
 */

import type { CardCoverageMode } from "./course-card-coverage";
import type { IFact } from "@/models/Fact";

export type FactForSelection = Pick<
  IFact,
  "factText" | "factType" | "tags" | "importance" | "confidence"
> & { originalIndex: number };

export type ConceptClusterTier =
  | "core_concept"
  | "prerequisite"
  | "test_worthy"
  | "major_supporting"
  | "example_notation_low";

export interface ConceptCluster {
  id: string;
  tierRank: number;
  members: FactForSelection[];
}

const TYPE_WEIGHT: Record<string, number> = {
  definition: 100,
  process: 94,
  cause_effect: 90,
  comparison: 88,
  classification: 86,
  exception: 82,
  threshold: 80,
  terminology: 58,
  example: 42,
  list_item: 28,
  emphasis: 22,
  other: 52,
};

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "and", "or", "of", "to", "in",
  "for", "on", "with", "as", "by", "that", "this", "these", "those", "from", "at",
  "be", "been", "being", "it", "its", "which",
]);

export function tokenizeForOverlap(text: string): Set<string> {
  const raw = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return new Set(raw);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function factPriorityScore(f: FactForSelection): number {
  const base = TYPE_WEIGHT[f.factType] ?? 50;
  const imp =
    f.importance === "high" ? 24 : f.importance === "medium" ? 12 : 0;
  const conf = Math.max(0, Math.min(1, f.confidence)) * 8;
  return base + imp + conf;
}

export function filterCardWorthyFacts(
  facts: FactForSelection[]
): FactForSelection[] {
  return facts.filter((f) => {
    const t = f.factText.trim();
    if (t.length < 12) return false;
    const lowValueType =
      f.factType === "list_item" ||
      f.factType === "emphasis" ||
      f.factType === "example";
    if (
      f.importance === "low" &&
      f.confidence < 0.45 &&
      lowValueType
    ) {
      return false;
    }
    if (
      f.importance === "low" &&
      f.confidence < 0.35 &&
      f.factType === "terminology"
    ) {
      return false;
    }
    return true;
  });
}

function clusterTierForMembers(members: FactForSelection[]): number {
  const types = new Set(members.map((m) => m.factType));
  const maxImp = members.some((m) => m.importance === "high")
    ? "high"
    : members.some((m) => m.importance === "medium")
      ? "medium"
      : "low";
  const textBlob = members.map((m) => m.factText).join(" ").toLowerCase();
  const tagBlob = members.flatMap((m) => m.tags ?? []).join(" ").toLowerCase();
  const prereqCue =
    /\b(prerequisite|prior knowledge|before we|you should know)\b/i.test(
      tagBlob + textBlob
    );

  if (types.has("example") && types.size === 1 && maxImp !== "high") return 1;
  if (types.has("terminology") && types.size === 1 && maxImp === "low") return 1;
  if (types.has("definition") || types.has("classification")) return 5;
  if (types.has("process") && maxImp !== "low") return 5;
  if (prereqCue || (types.has("terminology") && maxImp === "high")) return 4;
  if (
    types.has("comparison") ||
    types.has("exception") ||
    types.has("threshold") ||
    types.has("cause_effect")
  ) {
    return 3;
  }
  if (types.has("example")) return 2;
  if (maxImp === "low") return 1;
  return 2;
}

export function clusterFactsByOverlap(
  facts: FactForSelection[],
  similarityThreshold = 0.38
): ConceptCluster[] {
  const sorted = [...facts].sort(
    (a, b) => factPriorityScore(b) - factPriorityScore(a)
  );
  const buckets: { repTokens: Set<string>; members: FactForSelection[] }[] = [];

  for (const f of sorted) {
    const tokens = tokenizeForOverlap(f.factText);
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < buckets.length; i++) {
      const sim = jaccardSimilarity(tokens, buckets[i]!.repTokens);
      if (sim >= similarityThreshold && sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) buckets[bestIdx]!.members.push(f);
    else buckets.push({ repTokens: tokens, members: [f] });
  }

  return buckets.map((b, i) => ({
    id: `c${i}`,
    tierRank: clusterTierForMembers(b.members) + factPriorityScore(b.members[0]!) / 200,
    members: b.members,
  }));
}

const MODE_FACT_LIMITS: Record<CardCoverageMode, number> = {
  high: 220,
  balanced: 140,
  compressed: 85,
};

/**
 * Upper bound on facts passed to card generation: scales with lecture card-budget maxCards
 * (~1.75×), then clamped by mode ceiling so balanced mode does not always send 140 facts when
 * the card budget only needs mid-tens of cards.
 */
const FACTS_PER_MAX_CARD_MULT = 1.75;
const MIN_FACTS_FOR_SELECTION = 12;

function computeFactSelectionCap(
  mode: CardCoverageMode,
  maxCards: number
): {
  maxFacts: number;
  modeCeiling: number;
  budgetDerivedRaw: number;
} {
  const modeCeiling = MODE_FACT_LIMITS[mode];
  const budgetDerivedRaw = Math.ceil(maxCards * FACTS_PER_MAX_CARD_MULT);
  const maxFacts = Math.min(
    modeCeiling,
    Math.max(MIN_FACTS_FOR_SELECTION, budgetDerivedRaw)
  );
  return { maxFacts, modeCeiling, budgetDerivedRaw };
}

const MODE_CLUSTER_MULT: Record<CardCoverageMode, number> = {
  high: 1.2,
  balanced: 1.0,
  compressed: 0.85,
};

const MODE_FACTS_PER_CLUSTER: Record<CardCoverageMode, number> = {
  high: 3,
  balanced: 2,
  compressed: 1,
};

export function selectFactsForCardGeneration(
  allFacts: FactForSelection[],
  mode: CardCoverageMode,
  maxCards: number
): {
  selected: FactForSelection[];
  originalIndexMap: number[];
  clusters: ConceptCluster[];
  droppedFactCount: number;
  factSelectionCap: number;
  factCapModeCeiling: number;
  factCapBudgetDerived: number;
} {
  const { maxFacts, modeCeiling, budgetDerivedRaw } =
    computeFactSelectionCap(mode, maxCards);

  let worthy = filterCardWorthyFacts(allFacts);
  if (worthy.length === 0 && allFacts.length > 0) {
    worthy = [...allFacts].sort(
      (a, b) => factPriorityScore(b) - factPriorityScore(a)
    ).slice(0, Math.min(40, allFacts.length));
  }

  const clusters = clusterFactsByOverlap(worthy).sort(
    (a, b) => b.tierRank - a.tierRank
  );

  const maxClusters = Math.min(
    clusters.length,
    Math.ceil(maxCards * MODE_CLUSTER_MULT[mode])
  );
  const prioritized = clusters.slice(0, Math.max(1, maxClusters));
  const perCluster = MODE_FACTS_PER_CLUSTER[mode];

  const picked: FactForSelection[] = [];
  for (const cl of prioritized) {
    const ordered = [...cl.members].sort(
      (a, b) => factPriorityScore(b) - factPriorityScore(a)
    );
    const take = Math.min(perCluster, ordered.length);
    for (let i = 0; i < take; i++) picked.push(ordered[i]!);
    if (picked.length >= maxFacts) break;
  }

  const originalIndexMap = picked.map((f) => f.originalIndex);
  return {
    selected: picked,
    originalIndexMap,
    clusters,
    droppedFactCount: allFacts.length - worthy.length,
    factSelectionCap: maxFacts,
    factCapModeCeiling: modeCeiling,
    factCapBudgetDerived: budgetDerivedRaw,
  };
}

export function remapCardSourceIndices(
  sourceFactIndices: number[],
  originalIndexMap: number[]
): number[] {
  const out: number[] = [];
  for (const i of sourceFactIndices) {
    if (i >= 0 && i < originalIndexMap.length) {
      out.push(originalIndexMap[i]!);
    }
  }
  return [...new Set(out)];
}

export function deduplicateGeneratedCards<T extends { front: string; back: string }>(
  cards: T[],
  similarityThreshold = 0.68
): T[] {
  const kept: T[] = [];
  const frontSets: Set<string>[] = [];
  for (const card of cards) {
    const fTokens = tokenizeForOverlap(card.front);
    let duplicate = false;
    for (const prev of frontSets) {
      if (jaccardSimilarity(fTokens, prev) >= similarityThreshold) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) continue;
    kept.push(card);
    frontSets.push(fTokens);
  }
  return kept;
}

/** Drop generated cards whose fronts match existing deck cards (expansion pass). */
export function deduplicateGeneratedCardsAgainstExisting<
  T extends { front: string; back: string },
>(
  newCards: T[],
  existing: Array<{ front: string; back: string }>,
  similarityThreshold = 0.68
): T[] {
  const frontSets: Set<string>[] = existing.map((e) =>
    tokenizeForOverlap(e.front)
  );
  const kept: T[] = [];
  for (const card of newCards) {
    const fTokens = tokenizeForOverlap(card.front);
    let duplicate = false;
    for (const prev of frontSets) {
      if (jaccardSimilarity(fTokens, prev) >= similarityThreshold) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) continue;
    kept.push(card);
    frontSets.push(fTokens);
  }
  return kept;
}

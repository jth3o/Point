import { describe, expect, it } from "vitest";
import {
  deduplicateGeneratedCards,
  filterCardWorthyFacts,
  selectFactsForCardGeneration,
} from "./card-generation-selection";
import type { FactForSelection } from "./card-generation-selection";

function f(
  partial: Partial<FactForSelection> & Pick<FactForSelection, "factText" | "originalIndex">
): FactForSelection {
  return {
    factType: "other",
    tags: [],
    importance: "medium",
    confidence: 0.8,
    ...partial,
  };
}

describe("selectFactsForCardGeneration", () => {
  it("includes more facts for high coverage than low", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      f({
        originalIndex: i,
        factText: `Unique concept ${i} with sufficient length for the filter to keep it in the pool.`,
        factType: "definition",
        importance: "high",
      })
    );
    const hi = selectFactsForCardGeneration(many, "high", 90);
    const lo = selectFactsForCardGeneration(many, "compressed", 45);
    expect(hi.selected.length).toBeGreaterThan(lo.selected.length);
  });
});

describe("deduplicateGeneratedCards", () => {
  it("removes near-duplicate fronts", () => {
    const out = deduplicateGeneratedCards(
      [
        { front: "Define mitosis.", back: "Nuclear division." },
        { front: "Define mitosis in cells.", back: "Division of nucleus." },
      ],
      0.55
    );
    expect(out.length).toBe(1);
  });
});

describe("filterCardWorthyFacts", () => {
  it("drops weak list items", () => {
    const kept = filterCardWorthyFacts([
      f({
        originalIndex: 0,
        factText: "item",
        factType: "list_item",
        importance: "low",
        confidence: 0.2,
      }),
    ]);
    expect(kept).toHaveLength(0);
  });
});

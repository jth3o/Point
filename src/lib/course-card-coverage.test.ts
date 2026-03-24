import { describe, expect, it } from "vitest";
import {
  COVERAGE_BASE_60MIN,
  computeLectureCardBudget,
  computeMiniDeckBudget,
  parseCardCoverageMode,
} from "./course-card-coverage";

describe("COVERAGE_BASE_60MIN", () => {
  it("matches spec bands for ~60 min", () => {
    expect(COVERAGE_BASE_60MIN.high).toEqual({ min: 60, max: 100 });
    expect(COVERAGE_BASE_60MIN.balanced).toEqual({ min: 40, max: 70 });
    expect(COVERAGE_BASE_60MIN.compressed).toEqual({ min: 25, max: 50 });
  });
});

describe("computeLectureCardBudget", () => {
  it("scales high mode up for fact-rich lectures (memorization decks)", () => {
    const b = computeLectureCardBudget("high", 80);
    expect(b.maxCards).toBeGreaterThanOrEqual(85);
    expect(b.target).toBeGreaterThanOrEqual(70);
  });

  it("keeps compressed mode below balanced for same fact count", () => {
    const hi = computeLectureCardBudget("high", 55);
    const bal = computeLectureCardBudget("balanced", 55);
    const lo = computeLectureCardBudget("compressed", 55);
    expect(hi.maxCards).toBeGreaterThan(bal.maxCards);
    expect(bal.maxCards).toBeGreaterThan(lo.maxCards);
  });

  it("respects fact ceiling for tiny lectures", () => {
    const b = computeLectureCardBudget("high", 8);
    expect(b.maxCards).toBeLessThanOrEqual(24);
  });
});

describe("computeMiniDeckBudget", () => {
  it("caps mini-deck below full lecture budget", () => {
    const full = computeLectureCardBudget("balanced", 80);
    const mini = computeMiniDeckBudget(full);
    expect(mini.maxCards).toBeLessThanOrEqual(15);
    expect(mini.maxCards).toBeLessThanOrEqual(full.maxCards);
  });
});

describe("parseCardCoverageMode", () => {
  it("defaults invalid to balanced", () => {
    expect(parseCardCoverageMode("nope")).toBe("balanced");
  });

  it("maps legacy low to compressed", () => {
    expect(parseCardCoverageMode("low")).toBe("compressed");
  });
});

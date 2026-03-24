import { describe, expect, it } from "vitest";
import { groupSegmentsIntoBatches, normalizeChunkForExtraction } from "./fact-extraction-batch";

describe("groupSegmentsIntoBatches", () => {
  it("default cap keeps two ~2000-char segments in one batch", () => {
    const segs = [
      { cleanedText: "a".repeat(2000) },
      { cleanedText: "b".repeat(2000) },
    ];
    const batches = groupSegmentsIntoBatches(segs);
    expect(batches.length).toBe(1);
    expect(batches[0]).toHaveLength(2);
  });

  it("merges small segments into fewer batches", () => {
    const segs = Array.from({ length: 6 }, (_, i) => ({
      cleanedText: "x".repeat(800) + i,
    }));
    const batches = groupSegmentsIntoBatches(segs, 2500);
    expect(batches.length).toBeLessThan(segs.length);
    expect(batches.flat()).toHaveLength(6);
  });
});

describe("normalizeChunkForExtraction", () => {
  it("collapses excessive newlines", () => {
    expect(normalizeChunkForExtraction("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

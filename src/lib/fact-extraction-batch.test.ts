import { describe, expect, it } from "vitest";
import { groupSegmentsIntoBatches, normalizeChunkForExtraction } from "./fact-extraction-batch";

describe("groupSegmentsIntoBatches", () => {
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

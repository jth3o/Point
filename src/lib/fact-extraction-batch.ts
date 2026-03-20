/**
 * Group transcript segments into fewer LLM calls without changing stored segment granularity.
 */

import type mongoose from "mongoose";

/**
 * Max characters per extraction request (combined normalized segment text + part labels).
 * Lower than ~5k → smaller/faster completions; slightly more batches than a huge cap.
 */
export const DEFAULT_EXTRACTION_BATCH_MAX_CHARS = 3800;

export function normalizeChunkForExtraction(text: string): string {
  return text
    .trim()
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

export function groupSegmentsIntoBatches<T extends { cleanedText: string }>(
  segments: T[],
  maxChars: number = DEFAULT_EXTRACTION_BATCH_MAX_CHARS
): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  let len = 0;

  for (const seg of segments) {
    const t = normalizeChunkForExtraction(seg.cleanedText);
    const overhead = cur.length ? 48 : 0;
    const add = t.length + overhead;
    if (cur.length > 0 && len + add > maxChars) {
      batches.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(seg);
    len += add;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

export function buildBatchedExtractionUserContent(
  parts: Array<{ startTime: number; endTime: number; cleanedText: string }>
): string {
  const blocks = parts.map((p, i) => {
    const body = normalizeChunkForExtraction(p.cleanedText);
    return `Part ${i + 1} [${p.startTime}s–${p.endTime}s]\n${body}`;
  });
  return blocks.join("\n\n---\n\n");
}

export function resolveSegmentIdForFact(
  fact: {
    start_time: string | number;
    end_time: string | number;
    supporting_quote: string;
  },
  batch: Array<{
    _id: mongoose.Types.ObjectId;
    startTime: number;
    endTime: number;
    cleanedText: string;
  }>
): mongoose.Types.ObjectId {
  const s0 = Number(fact.start_time);
  const s1 = Number(fact.end_time);
  const mid =
    Number.isFinite(s0) && Number.isFinite(s1)
      ? (s0 + s1) / 2
      : Number.isFinite(s0)
        ? s0
        : NaN;
  if (Number.isFinite(mid)) {
    const hit = batch.find((b) => mid >= b.startTime && mid <= b.endTime);
    if (hit) return hit._id;
  }
  const q = fact.supporting_quote.trim().slice(0, 96).toLowerCase();
  if (q.length >= 10) {
    for (const b of batch) {
      if (b.cleanedText.toLowerCase().includes(q)) return b._id;
    }
    const short = q.slice(0, 24);
    if (short.length >= 8) {
      for (const b of batch) {
        if (b.cleanedText.toLowerCase().includes(short)) return b._id;
      }
    }
  }
  return batch[0]!._id;
}

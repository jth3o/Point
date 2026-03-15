/**
 * Segment transcript into logical chunks while preserving timestamps.
 * Configurable max chunk size (chars) and preference for sentence boundaries.
 */

import type { VttCue } from "./vtt-parser";
import { cleanTranscriptText } from "./transcript-cleaner";

export interface TranscriptChunk {
  startTime: number;
  endTime: number;
  rawText: string;
  cleanedText: string;
}

export interface SegmenterOptions {
  /** Max characters per chunk (soft limit). Default 1600. */
  maxChunkChars?: number;
  /** Prefer splitting on sentence boundaries. Default true. */
  preferSentenceBoundaries?: boolean;
}

const DEFAULT_OPTIONS: Required<SegmenterOptions> = {
  maxChunkChars: 1600,
  preferSentenceBoundaries: true,
};

const SENTENCE_END = /[.!?]\s+/;

function findSentenceBreak(text: string, afterIndex: number): number {
  const search = text.slice(afterIndex);
  const match = search.match(SENTENCE_END);
  if (!match || match.index == null) return -1;
  return afterIndex + match.index + match[0].length;
}

/**
 * Merge cues into larger segments, optionally cleaning each cue's text.
 * Chunks stay under maxChunkChars when possible, splitting on sentence boundaries.
 */
export function segmentTranscript(
  cues: VttCue[],
  options: SegmenterOptions = {}
): TranscriptChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (cues.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let currentRaw: string[] = [];
  let currentStart = cues[0]!.startTime;
  let currentEnd = cues[0]!.endTime;
  let currentLen = 0;

  for (const cue of cues) {
    const raw = cue.text.trim();
    if (!raw) {
      currentEnd = cue.endTime;
      continue;
    }
    const cleaned = cleanTranscriptText(raw);
    const addLen = (currentRaw.length ? 1 : 0) + cleaned.length;

    if (currentLen + addLen > opts.maxChunkChars && currentRaw.length > 0) {
      const rawText = currentRaw.join(" ");
      const cleanedText = cleanTranscriptText(rawText);
      chunks.push({
        startTime: currentStart,
        endTime: currentEnd,
        rawText,
        cleanedText,
      });
      currentRaw = [];
      currentLen = 0;
      currentStart = cue.startTime;
    }

    currentRaw.push(cleaned);
    currentLen += addLen;
    currentEnd = cue.endTime;
  }

  if (currentRaw.length > 0) {
    const rawText = currentRaw.join(" ");
    const cleanedText = cleanTranscriptText(rawText);
    chunks.push({
      startTime: currentStart,
      endTime: currentEnd,
      rawText,
      cleanedText,
    });
  }

  return chunks;
}

/**
 * If a single chunk exceeds maxChunkChars, split on sentence boundaries.
 * (Used when we want to further split already-merged chunks.)
 */
export function splitLargeChunk(
  chunk: TranscriptChunk,
  maxChars: number
): TranscriptChunk[] {
  if (chunk.cleanedText.length <= maxChars)
    return [chunk];

  const parts: TranscriptChunk[] = [];
  let start = 0;
  const text = chunk.cleanedText;
  const duration = chunk.endTime - chunk.startTime;
  const ratio = duration / text.length;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length && ratio > 0) {
      const preferred = findSentenceBreak(text, start);
      if (preferred > start && preferred <= start + maxChars) end = preferred;
    }
    const segmentText = text.slice(start, end).trim();
    if (segmentText) {
      parts.push({
        startTime: chunk.startTime + ratio * (start / text.length) * duration,
        endTime: chunk.startTime + ratio * (end / text.length) * duration,
        rawText: segmentText,
        cleanedText: segmentText,
      });
    }
    start = end;
  }

  return parts.length ? parts : [chunk];
}

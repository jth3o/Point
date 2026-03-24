import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Lecture, TranscriptSegment, Fact } from "@/models";
import {
  DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
  groupSegmentsIntoBatches,
  normalizeChunkForExtraction,
  resolveSegmentIdForFact,
} from "@/lib/fact-extraction-batch";
import { extractFactsFromSegmentBatch } from "@/lib/services/fact-extraction";
import { logPipeline } from "@/lib/pipeline-log";
import {
  setLectureStatusWithProgress,
  touchLectureProgress,
} from "./lecture-progress";
import { recordPipelineSystemError } from "@/lib/record-pipeline-bug";

const BATCH_CONCURRENCY = 4;

function extractionInputStats(
  batches: Array<Array<{ cleanedText: string }>>,
  segmentCount: number
) {
  if (batches.length === 0) {
    return {
      avgBatchChars: 0,
      maxBatchChars: 0,
      totalInputChars: 0,
      avgSegmentsPerBatch: 0,
      minSegmentsPerBatch: 0,
      maxSegmentsPerBatch: 0,
    };
  }
  const perBatch = batches.map((b) =>
    b.reduce(
      (sum, s) => sum + normalizeChunkForExtraction(s.cleanedText).length,
      0
    )
  );
  const totalInputChars = perBatch.reduce((a, c) => a + c, 0);
  const batchSizes = batches.map((b) => b.length);
  return {
    avgBatchChars: Math.round(totalInputChars / batches.length),
    maxBatchChars: Math.max(...perBatch),
    totalInputChars,
    avgSegmentsPerBatch: segmentCount / batches.length,
    minSegmentsPerBatch: Math.min(...batchSizes),
    maxSegmentsPerBatch: Math.max(...batchSizes),
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

export function shouldSkipExtraction(
  processingStatus: string,
  factCount: number,
  force: boolean
): boolean {
  if (force) return false;
  const completed =
    processingStatus === "facts_ready" ||
    processingStatus === "ready" ||
    processingStatus === "generating_initial_cards" ||
    processingStatus === "generating_remaining_cards" ||
    processingStatus === "generating_cards";
  return completed && factCount > 0;
}

export type ExtractFactsStepResult =
  | {
      ok: true;
      skipped: true;
      reason: string;
      factCount: number;
      processingStatus: string;
    }
  | {
      ok: true;
      skipped: false;
      factsCreated: number;
      extractionBatches: number;
      extractionModelCalls: number;
      extractionConcurrency: number;
      batchMaxChars: number;
      avgBatchChars: number;
      maxBatchChars: number;
      totalInputChars: number;
      avgSegmentsPerBatch: number;
      minSegmentsPerBatch: number;
      maxSegmentsPerBatch: number;
      elapsedMs: number;
      force: boolean;
    }
  | { ok: false; error: string };

export async function performExtractFacts(
  lectureId: string,
  options: { force?: boolean } = {}
): Promise<ExtractFactsStepResult> {
  const started = Date.now();
  const force = options.force === true;
  await connectDB();

  try {
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return { ok: false, error: "Lecture not found" };
    }

    const tLoadSegments = Date.now();
    const segments = await TranscriptSegment.find({ lectureId }).sort({
      sequence: 1,
    });
    logPipeline("load_segments", lectureId, { ms: Date.now() - tLoadSegments });

    if (!segments.length) {
      await recordPipelineSystemError({
        lectureId,
        stage: "extract_facts",
        errorMessage: "No transcript segments found. Segment the lecture first.",
        errorType: "no_segments",
      });
      return {
        ok: false,
        error: "No transcript segments found. Segment the lecture first.",
      };
    }

    const factCount = await Fact.countDocuments({ lectureId });
    if (shouldSkipExtraction(lecture.processingStatus, factCount, force)) {
      logPipeline("extract_facts_skipped", lectureId, {
        processingStatus: lecture.processingStatus,
        factCount,
        force,
        ms: Date.now() - started,
      });
      return {
        ok: true,
        skipped: true,
        reason: "Facts already extracted",
        factCount,
        processingStatus: lecture.processingStatus,
      };
    }

    await setLectureStatusWithProgress(lectureId, "extracting");

    const tDelete = Date.now();
    await Fact.deleteMany({ lectureId });
    logPipeline("delete_existing_facts", lectureId, { ms: Date.now() - tDelete });
    await touchLectureProgress(lectureId);

    const tBatches = Date.now();
    const batches = groupSegmentsIntoBatches(segments);
    const inputStats = extractionInputStats(batches, segments.length);
    logPipeline("build_batches", lectureId, {
      ms: Date.now() - tBatches,
      batchCount: batches.length,
    });

    logPipeline("extract_facts_start", lectureId, {
      segmentCount: segments.length,
      batchCount: batches.length,
      modelCalls: batches.length,
      batchMaxChars: DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
      extractionConcurrency: BATCH_CONCURRENCY,
      avgBatchChars: inputStats.avgBatchChars,
      maxBatchChars: inputStats.maxBatchChars,
      avgSegmentsPerBatch: Number(inputStats.avgSegmentsPerBatch.toFixed(3)),
      minSegmentsPerBatch: inputStats.minSegmentsPerBatch,
      maxSegmentsPerBatch: inputStats.maxSegmentsPerBatch,
      force,
    });

    const batchJobs = batches.map((batch, batchIndex) => ({ batch, batchIndex }));

    // Heartbeat before long concurrent batch work (avoids false stale if first batch is slow).
    await touchLectureProgress(lectureId);

    const batchResults = await runWithConcurrency(
      batchJobs,
      async ({ batch, batchIndex }) => {
        const tBatch = Date.now();
        const parts = batch.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          cleanedText: normalizeChunkForExtraction(s.cleanedText),
        }));
        const result = await extractFactsFromSegmentBatch(parts, {
          lectureId,
          batchIndex,
        });
        logPipeline("extract_facts_batch", lectureId, {
          batchIndex,
          ms: Date.now() - tBatch,
          factCount: result.facts.length,
        });
        await touchLectureProgress(lectureId);
        return { batch, result };
      },
      BATCH_CONCURRENCY
    );

    const docs: Array<{
      lectureId: string;
      segmentId: mongoose.Types.ObjectId;
      factText: string;
      factType: string;
      supportingQuote: string;
      startTime: number;
      endTime: number;
      confidence: number;
      importance: "low" | "medium" | "high";
      tags: string[];
      approved: boolean;
    }> = [];

    for (const { batch, result } of batchResults) {
      const batchLean = batch.map((s) => ({
        _id: s._id,
        startTime: s.startTime,
        endTime: s.endTime,
        cleanedText: normalizeChunkForExtraction(s.cleanedText),
      }));
      for (const fact of result.facts) {
        const segmentId = resolveSegmentIdForFact(fact, batchLean);
        const st = Number(fact.start_time);
        const et = Number(fact.end_time);
        docs.push({
          lectureId,
          segmentId,
          factText: fact.fact_text,
          factType: fact.fact_type,
          supportingQuote: fact.supporting_quote,
          startTime: Number.isFinite(st) ? st : batch[0]!.startTime,
          endTime: Number.isFinite(et) ? et : batch[0]!.endTime,
          confidence: fact.confidence,
          importance: fact.importance,
          tags: fact.tags,
          approved: false,
        });
      }
    }

    const tSaveFacts = Date.now();
    let inserted = 0;
    if (docs.length > 0) {
      const insertedDocs = await Fact.insertMany(docs, { ordered: true });
      inserted = insertedDocs.length;
    }
    logPipeline("save_facts", lectureId, { ms: Date.now() - tSaveFacts, inserted });
    await touchLectureProgress(lectureId);

    await setLectureStatusWithProgress(lectureId, "facts_ready");

    const elapsedMs = Date.now() - started;
    logPipeline("total_extract_facts", lectureId, { ms: elapsedMs });
    logPipeline("extract_facts_done", lectureId, {
      segmentCount: segments.length,
      batchCount: batches.length,
      modelCalls: batches.length,
      batchMaxChars: DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
      extractionConcurrency: BATCH_CONCURRENCY,
      avgBatchChars: inputStats.avgBatchChars,
      maxBatchChars: inputStats.maxBatchChars,
      totalInputChars: inputStats.totalInputChars,
      avgSegmentsPerBatch: Number(inputStats.avgSegmentsPerBatch.toFixed(3)),
      minSegmentsPerBatch: inputStats.minSegmentsPerBatch,
      maxSegmentsPerBatch: inputStats.maxSegmentsPerBatch,
      factsExtracted: inserted,
      elapsedMs,
      skipped: false,
      force,
    });

    return {
      ok: true,
      skipped: false,
      factsCreated: inserted,
      extractionBatches: batches.length,
      extractionModelCalls: batches.length,
      extractionConcurrency: BATCH_CONCURRENCY,
      batchMaxChars: DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
      avgBatchChars: inputStats.avgBatchChars,
      maxBatchChars: inputStats.maxBatchChars,
      totalInputChars: inputStats.totalInputChars,
      avgSegmentsPerBatch: Number(inputStats.avgSegmentsPerBatch.toFixed(3)),
      minSegmentsPerBatch: inputStats.minSegmentsPerBatch,
      maxSegmentsPerBatch: inputStats.maxSegmentsPerBatch,
      elapsedMs,
      force,
    };
  } catch (error: unknown) {
    console.error("performExtractFacts", lectureId, error);
    await setLectureStatusWithProgress(lectureId, "error").catch(() => undefined);
    const msg = error instanceof Error ? error.message : "Extract facts failed";
    await recordPipelineSystemError({
      lectureId,
      stage: "extract_facts",
      errorMessage: msg,
      errorType: "exception",
    });
    return {
      ok: false,
      error: msg,
    };
  }
}

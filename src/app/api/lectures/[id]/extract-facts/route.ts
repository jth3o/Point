import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture, TranscriptSegment, Fact } from "@/models";
import {
  DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
  groupSegmentsIntoBatches,
  normalizeChunkForExtraction,
  resolveSegmentIdForFact,
} from "@/lib/fact-extraction-batch";
import { extractFactsFromSegmentBatch } from "@/lib/services/fact-extraction";
import { logPipeline } from "@/lib/pipeline-log";

/** Parallel extraction calls (rate-limit aware; was 2 and became a wall-clock bottleneck). */
const BATCH_CONCURRENCY = 4;

function extractionInputStats(
  batches: Array<Array<{ cleanedText: string }>>
): {
  avgBatchChars: number;
  maxBatchChars: number;
  totalInputChars: number;
} {
  if (batches.length === 0) {
    return { avgBatchChars: 0, maxBatchChars: 0, totalInputChars: 0 };
  }
  const perBatch = batches.map((b) =>
    b.reduce(
      (sum, s) => sum + normalizeChunkForExtraction(s.cleanedText).length,
      0
    )
  );
  const totalInputChars = perBatch.reduce((a, c) => a + c, 0);
  return {
    avgBatchChars: Math.round(totalInputChars / batches.length),
    maxBatchChars: Math.max(...perBatch),
    totalInputChars,
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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const started = Date.now();
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await context.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 });
    }
    const owned = await isLectureOwnedByUser(id, userId);
    if (!owned) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }
    await connectDB();

    const lecture = await Lecture.findById(id);
    if (!lecture) {
      return NextResponse.json(
        { success: false, error: "Lecture not found" },
        { status: 404 }
      );
    }

    const segments = await TranscriptSegment.find({ lectureId: id }).sort({
      sequence: 1,
    });

    if (!segments.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No transcript segments found. Segment the lecture first.",
        },
        { status: 400 }
      );
    }

    await Fact.deleteMany({ lectureId: id });

    const batches = groupSegmentsIntoBatches(segments);
    const inputStats = extractionInputStats(batches);
    logPipeline("extract_facts_start", id, {
      segmentCount: segments.length,
      batchCount: batches.length,
      modelCalls: batches.length,
      batchMaxChars: DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
      extractionConcurrency: BATCH_CONCURRENCY,
      avgBatchChars: inputStats.avgBatchChars,
      maxBatchChars: inputStats.maxBatchChars,
    });

    const batchResults = await runWithConcurrency(
      batches,
      async (batch) => {
        const parts = batch.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          cleanedText: normalizeChunkForExtraction(s.cleanedText),
        }));
        const result = await extractFactsFromSegmentBatch(parts);
        return { batch, result };
      },
      BATCH_CONCURRENCY
    );

    const createdFacts = [];
    let factCountFromModel = 0;
    for (const { batch, result } of batchResults) {
      factCountFromModel += result.facts.length;
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
        const created = await Fact.create({
          lectureId: id,
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
        createdFacts.push(created);
      }
    }

    await Lecture.findByIdAndUpdate(id, {
      processingStatus: "facts_ready",
    });

    const elapsedMs = Date.now() - started;
    logPipeline("extract_facts_done", id, {
      segmentCount: segments.length,
      batchCount: batches.length,
      modelCalls: batches.length,
      batchMaxChars: DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
      extractionConcurrency: BATCH_CONCURRENCY,
      avgBatchChars: inputStats.avgBatchChars,
      maxBatchChars: inputStats.maxBatchChars,
      totalInputChars: inputStats.totalInputChars,
      factsExtracted: createdFacts.length,
      factsFromModel: factCountFromModel,
      elapsedMs,
    });

    return NextResponse.json({
      success: true,
      lectureId: id,
      factsCreated: createdFacts.length,
      extractionBatches: batches.length,
      extractionModelCalls: batches.length,
      extractionConcurrency: BATCH_CONCURRENCY,
      batchMaxChars: DEFAULT_EXTRACTION_BATCH_MAX_CHARS,
      avgBatchChars: inputStats.avgBatchChars,
      maxBatchChars: inputStats.maxBatchChars,
      elapsedMs,
    });
  } catch (error: unknown) {
    console.error("Extract facts route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to extract facts for lecture",
        details: error instanceof Error ? error.message : null,
      },
      { status: 500 }
    );
  }
}

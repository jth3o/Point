import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture, TranscriptSegment, Fact } from "@/models";
import { extractFactsFromSegment } from "@/lib/services/fact-extraction";

const EXTRACT_CONCURRENCY = 5;

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

    const segmentResults = await runWithConcurrency(
      segments,
      async (segment) => {
        const result = await extractFactsFromSegment({
          cleanedText: segment.cleanedText,
          startTime: String(segment.startTime),
          endTime: String(segment.endTime),
        });
        return { segment, result };
      },
      EXTRACT_CONCURRENCY
    );

    const createdFacts = [];
    for (const { segment, result } of segmentResults) {
      for (const fact of result.facts) {
        const created = await Fact.create({
          lectureId: id,
          segmentId: segment._id,
          factText: fact.fact_text,
          factType: fact.fact_type,
          supportingQuote: fact.supporting_quote,
          startTime: fact.start_time,
          endTime: fact.end_time,
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

    return NextResponse.json({
      success: true,
      lectureId: id,
      factsCreated: createdFacts.length,
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
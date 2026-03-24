import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { performExtractFacts } from "@/lib/lecture-pipeline/extract-facts-step";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseForce(request: NextRequest, body: Record<string, unknown>): boolean {
  if (body.force === true) return true;
  const q = request.nextUrl.searchParams.get("force");
  return q === "true" || q === "1";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 });
    }
    const owned = await isLectureOwnedByUser(id, userId);
    if (!owned) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const force = parseForce(request, body);

    const result = await performExtractFacts(id, { force });

    if (!result.ok) {
      if (result.error === "Lecture not found") {
        return NextResponse.json(
          { success: false, error: "Lecture not found" },
          { status: 404 }
        );
      }
      if (
        result.error ===
        "No transcript segments found. Segment the lecture first."
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "No transcript segments found. Segment the lecture first.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "Failed to extract facts for lecture",
          details: result.error,
        },
        { status: 500 }
      );
    }

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason:
          "Lecture already has extracted facts (facts_ready or ready with facts). Pass force=true to regenerate.",
        lectureId: id,
        processingStatus: result.processingStatus,
        factCount: result.factCount,
        force,
      });
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      lectureId: id,
      factsCreated: result.factsCreated,
      extractionBatches: result.extractionBatches,
      extractionModelCalls: result.extractionModelCalls,
      extractionConcurrency: result.extractionConcurrency,
      batchMaxChars: result.batchMaxChars,
      avgBatchChars: result.avgBatchChars,
      maxBatchChars: result.maxBatchChars,
      elapsedMs: result.elapsedMs,
      force,
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

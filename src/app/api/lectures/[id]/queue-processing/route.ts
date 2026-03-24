import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture } from "@/models";
import { triggerLectureWorker } from "@/lib/trigger-lecture-worker";

/** Lecture is actively being worked on by the pipeline (not queued waiting). */
const PIPELINE_BUSY = new Set([
  "segmenting",
  "segmented",
  "extracting",
  "generating_initial_cards",
  "generating_remaining_cards",
  "generating_cards",
]);

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Re-queue a lecture for background processing (retry / legacy idle) and poke the worker.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
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

    await connectDB();
    const lecture = await Lecture.findById(id);
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    if (lecture.processingStatus === "ready") {
      return NextResponse.json(
        { error: "Lecture is already complete" },
        { status: 400 }
      );
    }

    if (PIPELINE_BUSY.has(lecture.processingStatus)) {
      return NextResponse.json(
        { error: "Lecture is already processing" },
        { status: 409 }
      );
    }

    await Lecture.findByIdAndUpdate(id, {
      $set: {
        processingStatus: "queued",
        lastProgressAt: new Date(),
      },
    });

    triggerLectureWorker();

    return NextResponse.json({
      success: true,
      lectureId: id,
      processingStatus: "queued",
    });
  } catch (e) {
    console.error("POST /api/lectures/[id]/queue-processing", e);
    return NextResponse.json(
      { error: "Failed to queue lecture" },
      { status: 500 }
    );
  }
}

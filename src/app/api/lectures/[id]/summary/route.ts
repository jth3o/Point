import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture, TranscriptSegment, Fact, Card } from "@/models";
import { nudgeWorkerIfLectureQueued } from "@/lib/lecture-pipeline/lecture-progress";
import type { ILecture } from "@/models/Lecture";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
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
    const lecture = await Lecture.findById(id).lean() as (ILecture & { _id: mongoose.Types.ObjectId }) | null;
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }
    const [segmentCount, factCount, cardCount] = await Promise.all([
      TranscriptSegment.countDocuments({ lectureId: id }),
      Fact.countDocuments({ lectureId: id }),
      Card.countDocuments({ lectureId: id }),
    ]);
    void nudgeWorkerIfLectureQueued(id).catch(() => undefined);

    return NextResponse.json({
      processingStatus: lecture.processingStatus,
      segmentCount,
      factCount,
      cardCount,
    });
  } catch (e) {
    console.error("GET /api/lectures/[id]/summary", e);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}

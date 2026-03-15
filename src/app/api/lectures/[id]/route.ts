import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture, TranscriptSegment, Fact, Card, ReviewState, ReviewLog } from "@/models";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
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
    const lecture = await Lecture.findById(id).lean();
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }
    return NextResponse.json(lecture);
  } catch (e) {
    console.error("GET /api/lectures/[id]", e);
    return NextResponse.json(
      { error: "Failed to fetch lecture" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
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
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const cards = await Card.find({ lectureId: id }).select("_id").lean();
    const cardIds = cards.map((c) => c._id);

    await ReviewState.deleteMany({ cardId: { $in: cardIds } });
    await ReviewLog.deleteMany({ cardId: { $in: cardIds } });
    await Card.deleteMany({ lectureId: id });
    await Fact.deleteMany({ lectureId: id });
    await TranscriptSegment.deleteMany({ lectureId: id });
    await Lecture.deleteOne({ _id: id });

    return NextResponse.json({ success: true, deleted: true });
  } catch (e) {
    console.error("DELETE /api/lectures/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete lecture" },
      { status: 500 }
    );
  }
}

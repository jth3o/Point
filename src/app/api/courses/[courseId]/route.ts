import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import {
  Course,
  Lecture,
  TranscriptSegment,
  Fact,
  Card,
  ReviewState,
  ReviewLog,
} from "@/models";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { courseId } = await context.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
    }
    await connectDB();
    const course = await Course.findOne({ _id: courseId, userId }).lean();
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    return NextResponse.json(course);
  } catch (e) {
    console.error("GET /api/courses/[courseId]", e);
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { courseId } = await context.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
    }
    await connectDB();
    const course = await Course.findOne({ _id: courseId, userId });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.cardCoverageMode !== undefined && body.cardCoverageMode !== null) {
      if (
        body.cardCoverageMode !== "high" &&
        body.cardCoverageMode !== "balanced" &&
        body.cardCoverageMode !== "compressed"
      ) {
        return NextResponse.json(
          {
            error:
              "cardCoverageMode must be one of: high, balanced, compressed",
          },
          { status: 400 }
        );
      }
      course.cardCoverageMode = body.cardCoverageMode;
    }

    if (typeof body.title === "string" && body.title.trim()) {
      course.title = body.title.trim();
    }

    await course.save();
    return NextResponse.json(course.toObject());
  } catch (e) {
    console.error("PATCH /api/courses/[courseId]", e);
    return NextResponse.json(
      { error: "Failed to update course" },
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
    const { courseId } = await context.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
    }

    await connectDB();
    const course = await Course.findOne({ _id: courseId, userId });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const lectures = await Lecture.find({ courseId }).select("_id").lean();
    const lectureIds = lectures.map((l) => l._id);

    const cards = await Card.find({ lectureId: { $in: lectureIds } }).select("_id").lean();
    const cardIds = cards.map((c) => c._id);

    await ReviewState.deleteMany({ cardId: { $in: cardIds } });
    await ReviewLog.deleteMany({ cardId: { $in: cardIds } });
    await Card.deleteMany({ lectureId: { $in: lectureIds } });
    await Fact.deleteMany({ lectureId: { $in: lectureIds } });
    await TranscriptSegment.deleteMany({ lectureId: { $in: lectureIds } });
    await Lecture.deleteMany({ courseId });
    await Course.deleteOne({ _id: courseId });

    return NextResponse.json({ success: true, deleted: true });
  } catch (e) {
    console.error("DELETE /api/courses/[courseId]", e);
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}

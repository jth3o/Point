import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { Course, Lecture, Fact, Card } from "@/models";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { courseId } = await params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
    }
    await connectDB();
    const course = await Course.findOne({ _id: courseId, userId }).lean();
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const lectures = await Lecture.find({ courseId })
      .sort({ createdAt: -1 })
      .lean();
    const lecturesWithCounts = await Promise.all(
      lectures.map(async (lec) => {
        const [factCount, cardCount] = await Promise.all([
          Fact.countDocuments({ lectureId: lec._id }),
          Card.countDocuments({ lectureId: lec._id }),
        ]);
        return { ...lec, factCount, cardCount };
      })
    );
    return NextResponse.json(lecturesWithCounts);
  } catch (e) {
    console.error("GET /api/courses/[courseId]/lectures", e);
    return NextResponse.json(
      { error: "Failed to list lectures" },
      { status: 500 }
    );
  }
}

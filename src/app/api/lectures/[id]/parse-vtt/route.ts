import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture } from "@/models";
import { parseVtt } from "@/lib/vtt-parser";

/**
 * Parse the lecture's stored VTT content and update processing status.
 * Does not store segments; use segment route for that.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
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
    if (!lecture.vttContent) {
      return NextResponse.json(
        { error: "No VTT content stored for this lecture" },
        { status: 400 }
      );
    }

    lecture.processingStatus = "parsing";
    await lecture.save();

    const cues = parseVtt(lecture.vttContent);
    lecture.processingStatus = "parsed";
    await lecture.save();

    return NextResponse.json({
      lectureId: id,
      cueCount: cues.length,
      cues: cues.slice(0, 50), // return first 50 for debugging; full parse is stored in lecture for segment step
    });
  } catch (e) {
    console.error("POST /api/lectures/[id]/parse-vtt", e);
    return NextResponse.json(
      { error: "Failed to parse VTT" },
      { status: 500 }
    );
  }
}

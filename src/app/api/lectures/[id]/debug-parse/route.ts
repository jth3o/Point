import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture } from "@/models";
import { parseVtt } from "@/lib/vtt-parser";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

    const lecture = await Lecture.findById(id);
    if (!lecture) {
      return NextResponse.json(
        { success: false, error: "Lecture not found" },
        { status: 404 }
      );
    }

    const rawVtt = lecture.vttContent || "";
    const cues = parseVtt(rawVtt);

    return NextResponse.json({
      success: true,
      rawLength: rawVtt.length,
      rawPreview: rawVtt.slice(0, 500),
      cueCount: cues.length,
      cues: cues.slice(0, 5),
    });
  } catch (error) {
    console.error("Debug parse route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to debug parse lecture",
      },
      { status: 500 }
    );
  }
}
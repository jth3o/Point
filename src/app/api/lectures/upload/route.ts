import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { Course, Lecture } from "@/models";
import { kickQueueAfterLectureMutation } from "@/lib/trigger-lecture-worker";
import { queueDiag } from "@/lib/lecture-pipeline/queue-diag-log";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const courseId = formData.get("courseId") as string | null;
    const title = (formData.get("title") as string)?.trim() || null;

    if (!file) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 }
      );
    }
    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 }
      );
    }
    await connectDB();
    const course = await Course.findOne({ _id: courseId, userId }).lean();
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".vtt")) {
      return NextResponse.json(
        { error: "Only .vtt files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 4MB)" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const vttContent = new TextDecoder("utf-8").decode(buffer);

    const now = new Date();
    const lecture = await Lecture.create({
      courseId,
      title: title || file.name.replace(/\.vtt$/i, ""),
      filename: file.name,
      uploadStatus: "uploaded",
      processingStatus: "queued",
      vttContent,
      lastProgressAt: now,
      processingAttemptCount: 0,
    });

    queueDiag("upload.before_kick", {
      lectureId: String(lecture._id),
      processingStatus: lecture.processingStatus,
    });
    await kickQueueAfterLectureMutation();
    queueDiag("upload.after_kick", { lectureId: String(lecture._id) });

    return NextResponse.json(lecture);
  } catch (e) {
    console.error("POST /api/lectures/upload", e);
    return NextResponse.json(
      { error: "Failed to upload lecture" },
      { status: 500 }
    );
  }
}

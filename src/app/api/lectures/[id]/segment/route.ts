import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { TranscriptSegment } from "@/models";
import { performSegment } from "@/lib/lecture-pipeline/segment-step";

const DEFAULT_MAX_CHUNK_CHARS = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 });
  }

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const owned = await isLectureOwnedByUser(id, userId);
    if (!owned) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    let maxChunkChars = DEFAULT_MAX_CHUNK_CHARS;
    try {
      const body = await request.json().catch(() => ({}));
      if (typeof body.maxChunkChars === "number" && body.maxChunkChars > 0) {
        maxChunkChars = body.maxChunkChars;
      }
    } catch {
      // no body is fine
    }

    const result = await performSegment(id, maxChunkChars);
    if (!result.ok) {
      const status =
        result.error === "Lecture not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    await connectDB();
    const segments = await TranscriptSegment.find({ lectureId: id })
      .sort({ sequence: 1 })
      .lean();

    return NextResponse.json({
      lectureId: id,
      segmentCount: result.segmentCount,
      segments: segments.map((s) => ({
        _id: s._id,
        sequence: s.sequence,
        startTime: s.startTime,
        endTime: s.endTime,
        cleanedText:
          s.cleanedText.slice(0, 100) + (s.cleanedText.length > 100 ? "…" : ""),
      })),
    });
  } catch (e) {
    console.error("POST /api/lectures/[id]/segment", e);
    return NextResponse.json(
      { error: "Failed to segment transcript" },
      { status: 500 }
    );
  }
}

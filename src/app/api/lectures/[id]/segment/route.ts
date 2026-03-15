import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture, TranscriptSegment } from "@/models";
import { parseVtt } from "@/lib/vtt-parser";
import { segmentTranscript } from "@/lib/segmenter";

const DEFAULT_MAX_CHUNK_CHARS = 1600;

/**
 * Parse VTT (if not already), segment into chunks, and store TranscriptSegments.
 */
export async function POST(
  request: NextRequest,
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

    let maxChunkChars = DEFAULT_MAX_CHUNK_CHARS;
    try {
      const body = await request.json().catch(() => ({}));
      if (typeof body.maxChunkChars === "number" && body.maxChunkChars > 0) {
        maxChunkChars = body.maxChunkChars;
      }
    } catch {
      // no body or invalid JSON is fine
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

    lecture.processingStatus = "segmenting";
    await lecture.save();

    const cues = parseVtt(lecture.vttContent);
    const chunks = segmentTranscript(cues, { maxChunkChars });

    // Remove existing segments for this lecture (re-segment)
    await TranscriptSegment.deleteMany({ lectureId: id });

    const segments = await TranscriptSegment.insertMany(
      chunks.map((chunk, i) => ({
        lectureId: id,
        sequence: i + 1,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        rawText: chunk.rawText,
        cleanedText: chunk.cleanedText,
      }))
    );

    lecture.processingStatus = "segmented";
    await lecture.save();

    return NextResponse.json({
      lectureId: id,
      segmentCount: segments.length,
      segments: segments.map((s) => ({
        _id: s._id,
        sequence: s.sequence,
        startTime: s.startTime,
        endTime: s.endTime,
        cleanedText: s.cleanedText.slice(0, 100) + (s.cleanedText.length > 100 ? "…" : ""),
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

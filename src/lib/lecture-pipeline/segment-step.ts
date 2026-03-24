import { connectDB } from "@/lib/db";
import { Lecture, TranscriptSegment } from "@/models";
import { parseVtt } from "@/lib/vtt-parser";
import { segmentTranscript } from "@/lib/segmenter";
import { logPipeline } from "@/lib/pipeline-log";
import { setLectureStatusWithProgress } from "./lecture-progress";
import { recordPipelineSystemError } from "@/lib/record-pipeline-bug";

const DEFAULT_MAX_CHUNK_CHARS = 2000;

export type SegmentStepResult =
  | { ok: true; segmentCount: number }
  | { ok: false; error: string };

/**
 * Server-side segment step (same behavior as POST /api/lectures/[id]/segment).
 */
export async function performSegment(
  lectureId: string,
  maxChunkChars: number = DEFAULT_MAX_CHUNK_CHARS
): Promise<SegmentStepResult> {
  const started = Date.now();
  await connectDB();

  try {
    const tRead = Date.now();
    const lecture = await Lecture.findById(lectureId);
    logPipeline("read_lecture_vtt", lectureId, { ms: Date.now() - tRead });

    if (!lecture) {
      return { ok: false, error: "Lecture not found" };
    }
    if (!lecture.vttContent) {
      await recordPipelineSystemError({
        lectureId,
        stage: "segment",
        errorMessage: "No VTT content stored for this lecture",
        errorType: "missing_vtt",
      });
      return { ok: false, error: "No VTT content stored for this lecture" };
    }

    await setLectureStatusWithProgress(lectureId, "segmenting");

    const tParse = Date.now();
    const cues = parseVtt(lecture.vttContent);
    logPipeline("parse_vtt_cues", lectureId, {
      ms: Date.now() - tParse,
      cueCount: cues.length,
    });

    const tSeg = Date.now();
    const chunks = segmentTranscript(cues, { maxChunkChars });
    logPipeline("segment_transcript", lectureId, {
      ms: Date.now() - tSeg,
      chunkCount: chunks.length,
    });

    const tSave = Date.now();
    await TranscriptSegment.deleteMany({ lectureId });

    const segments = await TranscriptSegment.insertMany(
      chunks.map((chunk, i) => ({
        lectureId,
        sequence: i + 1,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        rawText: chunk.rawText,
        cleanedText: chunk.cleanedText,
      }))
    );
    logPipeline("save_segments", lectureId, {
      ms: Date.now() - tSave,
      segmentCount: segments.length,
    });

    await setLectureStatusWithProgress(lectureId, "segmented");

    logPipeline("total_segment", lectureId, { ms: Date.now() - started });

    return { ok: true, segmentCount: segments.length };
  } catch (e) {
    console.error("performSegment", lectureId, e);
    await setLectureStatusWithProgress(lectureId, "error").catch(() => undefined);
    const msg = e instanceof Error ? e.message : "Segment failed";
    await recordPipelineSystemError({
      lectureId,
      stage: "segment",
      errorMessage: msg,
      errorType: "exception",
    });
    return {
      ok: false,
      error: msg,
    };
  }
}

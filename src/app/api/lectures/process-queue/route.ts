import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { claimNextQueuedLecture } from "@/lib/lecture-pipeline/claim-queued";
import { runLecturePipeline } from "@/lib/lecture-pipeline/run-lecture-pipeline";
import {
  recoverStaleLectures,
  triggerWorkerIfQueuedRemain,
} from "@/lib/lecture-pipeline/lecture-progress";
import { recordPipelineSystemError } from "@/lib/record-pipeline-bug";

/** Allow long runs on Vercel when configured. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.LECTURE_WORKER_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const staleRecovery = await recoverStaleLectures();

  const lectureId = await claimNextQueuedLecture();
  let pipelineOk: boolean | null = null;
  let pipelineError: string | null = null;
  if (lectureId) {
    try {
      const result = await runLecturePipeline(lectureId);
      pipelineOk = result.ok;
      pipelineError = result.error ?? null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pipeline threw unexpectedly";
      pipelineOk = false;
      pipelineError = msg;
      await recordPipelineSystemError({
        lectureId,
        stage: "process_queue",
        errorMessage: msg,
        errorType: "pipeline_unhandled_exception",
      });
    }
  }

  await triggerWorkerIfQueuedRemain();

  return NextResponse.json({
    success: true,
    staleRecovery,
    processedLectureId: lectureId,
    pipelineOk,
    pipelineError,
  });
}

import { connectDB } from "@/lib/db";
import { claimNextQueuedLecture } from "./claim-queued";
import { runLecturePipeline } from "./run-lecture-pipeline";
import {
  recoverStaleLectures,
  triggerWorkerIfQueuedRemain,
} from "./lecture-progress";
import { recordPipelineSystemError } from "@/lib/record-pipeline-bug";

export type ProcessQueueCycleResult = {
  staleRecovery: Awaited<ReturnType<typeof recoverStaleLectures>>;
  processedLectureId: string | null;
  pipelineOk: boolean | null;
  pipelineError: string | null;
};

/**
 * One pass: stale recovery → claim oldest queued → run full pipeline → nudge if more queued.
 * Used by POST /api/lectures/process-queue and by in-process triggers (unstable_after).
 */
export async function runProcessQueueCycle(): Promise<ProcessQueueCycleResult> {
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

  return {
    staleRecovery,
    processedLectureId: lectureId,
    pipelineOk,
    pipelineError,
  };
}

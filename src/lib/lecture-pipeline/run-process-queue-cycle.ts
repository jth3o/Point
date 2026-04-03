import { connectDB } from "@/lib/db";
import {
  claimNextQueuedLecture,
  claimQueuedLectureById,
} from "./claim-queued";
import { runLecturePipeline } from "./run-lecture-pipeline";
import {
  recoverStaleLectures,
  triggerWorkerIfQueuedRemain,
} from "./lecture-progress";
import { recordPipelineSystemError } from "@/lib/record-pipeline-bug";
import { queueDiag } from "./queue-diag-log";

export type ProcessQueueCycleResult = {
  staleRecovery: Awaited<ReturnType<typeof recoverStaleLectures>>;
  processedLectureId: string | null;
  pipelineOk: boolean | null;
  pipelineError: string | null;
};

/**
 * One pass: stale recovery → claim queued work → run full pipeline → nudge if more queued.
 * Used by POST /api/lectures/process-queue and by in-process triggers (unstable_after).
 *
 * `preferredLectureId`: try this lecture first (e.g. manual queue) before global FIFO claim.
 */
export async function runProcessQueueCycle(options?: {
  preferredLectureId?: string;
}): Promise<ProcessQueueCycleResult> {
  queueDiag("runProcessQueueCycle.enter", {
    preferredLectureId: options?.preferredLectureId,
  });
  await connectDB();

  const staleRecovery = await recoverStaleLectures();
  queueDiag("runProcessQueueCycle.stale_recovery", {
    requeued: staleRecovery.requeued,
    markedError: staleRecovery.markedError,
  });

  let lectureId: string | null = null;
  if (options?.preferredLectureId) {
    lectureId = await claimQueuedLectureById(options.preferredLectureId);
    queueDiag("runProcessQueueCycle.after_preferred_claim", {
      preferredLectureId: options.preferredLectureId,
      claimedLectureId: lectureId,
    });
  }
  if (!lectureId) {
    lectureId = await claimNextQueuedLecture();
  }
  let pipelineOk: boolean | null = null;
  let pipelineError: string | null = null;
  if (lectureId) {
    queueDiag("runProcessQueueCycle.pipeline_start", { lectureId });
    try {
      const result = await runLecturePipeline(lectureId);
      pipelineOk = result.ok;
      pipelineError = result.error ?? null;
      queueDiag("runProcessQueueCycle.pipeline_end", {
        lectureId,
        pipelineOk,
        pipelineError,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pipeline threw unexpectedly";
      pipelineOk = false;
      pipelineError = msg;
      queueDiag("runProcessQueueCycle.pipeline_throw", {
        lectureId,
        message: msg,
      });
      await recordPipelineSystemError({
        lectureId,
        stage: "process_queue",
        errorMessage: msg,
        errorType: "pipeline_unhandled_exception",
      });
    }
  } else {
    queueDiag("runProcessQueueCycle.no_claim", {
      note: "no queued lecture claimed this cycle",
    });
  }

  await triggerWorkerIfQueuedRemain();

  const out: ProcessQueueCycleResult = {
    staleRecovery,
    processedLectureId: lectureId,
    pipelineOk,
    pipelineError,
  };
  queueDiag("runProcessQueueCycle.exit", {
    processedLectureId: out.processedLectureId,
    pipelineOk: out.pipelineOk,
    pipelineError: out.pipelineError,
  });
  return out;
}

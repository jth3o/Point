import { connectDB } from "@/lib/db";
import { Lecture, type ILecture } from "@/models";
import type { ProcessingStatus } from "@/models/Lecture";

/** Busy states where the worker may be mid-pipeline (eligible for stale recovery). */
export const STALE_BUSY_STATUSES: ProcessingStatus[] = [
  "segmenting",
  "segmented",
  "extracting",
  "facts_ready",
  "generating_cards",
  "generating_initial_cards",
  "generating_remaining_cards",
];

/** No progress heartbeat older than this → treat as stale (minutes). */
export const STALE_THRESHOLD_MINUTES = 15;

/** Max completed pipeline attempts (claim increments) before stale recovery gives up. */
export const MAX_PIPELINE_ATTEMPTS = 5;

export const STALE_MS = STALE_THRESHOLD_MINUTES * 60 * 1000;

/**
 * Stricter threshold for long single-call LLM steps (`extracting`, `generating_remaining_cards`).
 * Without mid-call heartbeats, the default 15m window can expire during one model call.
 */
export const STALE_MS_EXTRACTING = 10 * 60 * 1000;

const LONG_LLM_STALE_STATUSES: ProcessingStatus[] = [
  "extracting",
  "generating_remaining_cards",
];

/** Lecture states that may need process-queue to run (queued or mid-pipeline). */
const STATUSES_NEEDING_WORKER: ProcessingStatus[] = [
  "queued",
  "segmenting",
  "segmented",
  "extracting",
  "facts_ready",
  "generating_cards",
  "generating_initial_cards",
  "generating_remaining_cards",
];

/**
 * Heartbeat only (status unchanged). Use during long steps (e.g. per extraction batch).
 */
export async function touchLectureProgress(lectureId: string): Promise<void> {
  await connectDB();
  await Lecture.findByIdAndUpdate(lectureId, {
    $set: { lastProgressAt: new Date() },
  });
}

/**
 * Set processing status and lastProgressAt. For `ready`, clears currentRunId.
 */
export async function setLectureStatusWithProgress(
  lectureId: string,
  status: ProcessingStatus,
  options?: { unsetRunId?: boolean }
): Promise<void> {
  await connectDB();
  const now = new Date();
  const update: {
    $set: Record<string, unknown>;
    $unset?: Record<string, string>;
  } = {
    $set: {
      processingStatus: status,
      lastProgressAt: now,
    },
  };
  if (options?.unsetRunId || status === "ready") {
    update.$unset = { currentRunId: "" };
  }
  await Lecture.findByIdAndUpdate(lectureId, update);
}

/**
 * Before claiming new work: requeue or error lectures stuck in busy states without progress.
 */
export async function recoverStaleLectures(): Promise<{
  requeued: number;
  markedError: number;
}> {
  await connectDB();
  let requeued = 0;
  let markedError = 0;

  const stuck = await Lecture.find({
    processingStatus: { $in: STALE_BUSY_STATUSES },
  }).lean();

  for (const doc of stuck) {
    const lec = doc as unknown as ILecture;
    const staleMs = LONG_LLM_STALE_STATUSES.includes(lec.processingStatus)
      ? STALE_MS_EXTRACTING
      : STALE_MS;
    const staleCutoff = new Date(Date.now() - staleMs);
    const ref =
      lec.lastProgressAt ?? lec.processingStartedAt ?? lec.createdAt;
    if (!ref || ref.getTime() >= staleCutoff.getTime()) {
      continue;
    }

    const attempts = lec.processingAttemptCount ?? 0;
    if (attempts >= MAX_PIPELINE_ATTEMPTS) {
      await Lecture.updateOne(
        { _id: lec._id },
        {
          $set: {
            processingStatus: "error" as ProcessingStatus,
            lastProgressAt: new Date(),
          },
        }
      );
      markedError += 1;
      const { recordStaleRecoveryAbandoned } = await import(
        "@/lib/record-pipeline-bug"
      );
      void recordStaleRecoveryAbandoned({
        lectureId: String(lec._id),
        attempts,
      });
    } else {
      await Lecture.updateOne(
        { _id: lec._id },
        {
          $set: {
            processingStatus: "queued" as ProcessingStatus,
            lastProgressAt: new Date(),
          },
          $unset: { currentRunId: "", processingStartedAt: "" },
        }
      );
      requeued += 1;
    }
  }

  return { requeued, markedError };
}

/**
 * If any lecture is still queued, nudge the worker (idempotent extra wake-up).
 */
export async function triggerWorkerIfQueuedRemain(): Promise<void> {
  await connectDB();
  const n = await Lecture.countDocuments({ processingStatus: "queued" });
  if (n > 0) {
    const { triggerLectureWorker } = await import("@/lib/trigger-lecture-worker");
    triggerLectureWorker();
  }
}

/**
 * Poll/load nudge: if this course has any lecture that is queued or mid-pipeline,
 * wake the worker once (so stuck `extracting` / etc. can be recovered when the user returns).
 */
export async function nudgeWorkerIfCourseHasQueued(
  courseId: string
): Promise<void> {
  await connectDB();
  const n = await Lecture.countDocuments({
    courseId,
    processingStatus: { $in: STATUSES_NEEDING_WORKER },
  });
  if (n > 0) {
    const { triggerLectureWorker } = await import("@/lib/trigger-lecture-worker");
    triggerLectureWorker();
  }
}

/** Lecture page poll: nudge if this lecture is queued or still being processed. */
export async function nudgeWorkerIfLectureQueued(
  lectureId: string
): Promise<void> {
  await connectDB();
  const n = await Lecture.countDocuments({
    _id: lectureId,
    processingStatus: { $in: STATUSES_NEEDING_WORKER },
  });
  if (n > 0) {
    const { triggerLectureWorker } = await import("@/lib/trigger-lecture-worker");
    triggerLectureWorker();
  }
}

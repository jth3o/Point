import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Lecture, type ILecture } from "@/models";
import { queueDiag } from "./queue-diag-log";

function claimUpdate(now: Date) {
  return {
    $set: {
      processingStatus: "segmenting" as const,
      processingStartedAt: now,
      lastProgressAt: now,
      currentRunId: randomUUID(),
    },
    $inc: { processingAttemptCount: 1 },
  };
}

/**
 * Claim a specific lecture if it is queued (manual retry / targeted run).
 */
export async function claimQueuedLectureById(
  lectureId: string
): Promise<string | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(lectureId)) return null;
  const now = new Date();
  const doc = (await Lecture.findOneAndUpdate(
    { _id: lectureId, processingStatus: "queued" },
    claimUpdate(now),
    { new: true }
  ).lean()) as ILecture | null;
  const id = doc?._id ? String(doc._id) : null;
  queueDiag("claimQueuedLectureById", { lectureId, claimed: Boolean(id) });
  return id;
}

/**
 * Atomically claim the oldest queued lecture: queued → segmenting, with run metadata.
 * Only documents with processingStatus "queued" can match.
 */
export async function claimNextQueuedLecture(): Promise<string | null> {
  await connectDB();
  const queuedCount = await Lecture.countDocuments({
    processingStatus: "queued",
  });
  queueDiag("claimNextQueuedLecture.before", { queuedCount });

  const now = new Date();
  const doc = (await Lecture.findOneAndUpdate(
    { processingStatus: "queued" },
    claimUpdate(now),
    { sort: { createdAt: 1 }, new: true }
  ).lean()) as ILecture | null;

  const id = doc?._id ? String(doc._id) : null;
  if (!id && queuedCount > 0) {
    queueDiag("claimNextQueuedLecture.unexpected_null", {
      queuedCount,
      note: "count>0 but findOneAndUpdate returned null — check DB/driver",
    });
  }
  queueDiag("claimNextQueuedLecture.after", {
    claimedLectureId: id,
    newStatus: doc?.processingStatus,
    attemptCount: doc?.processingAttemptCount,
  });
  return id;
}

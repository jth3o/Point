import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { Lecture, type ILecture } from "@/models";

/**
 * Atomically claim the oldest queued lecture: queued → segmenting, with run metadata.
 * Only documents with processingStatus "queued" can match.
 */
export async function claimNextQueuedLecture(): Promise<string | null> {
  await connectDB();
  const now = new Date();
  const doc = (await Lecture.findOneAndUpdate(
    { processingStatus: "queued" },
    {
      $set: {
        processingStatus: "segmenting",
        processingStartedAt: now,
        lastProgressAt: now,
        currentRunId: randomUUID(),
      },
      $inc: { processingAttemptCount: 1 },
    },
    { sort: { createdAt: 1 }, new: true }
  ).lean()) as ILecture | null;
  return doc?._id ? String(doc._id) : null;
}

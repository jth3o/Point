import { connectDB } from "@/lib/db";
import {
  BugReport,
  Lecture,
  Course,
  User,
  TranscriptSegment,
  Fact,
  Card,
} from "@/models";
import type { ILecture } from "@/models/Lecture";
import type { ICourse } from "@/models/Course";

function envLabel(): string {
  return (
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "unknown"
  );
}

/**
 * Best-effort system bug report for lecture pipeline failures. Never throws to callers.
 */
export async function recordPipelineSystemError(input: {
  lectureId: string;
  stage: string;
  errorMessage: string;
  errorType?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await connectDB();
    const lecture = (await Lecture.findById(input.lectureId).lean()) as ILecture | null;
    if (!lecture) return;

    const course = lecture.courseId
      ? ((await Course.findById(lecture.courseId).select("userId").lean()) as
          | Pick<ICourse, "userId">
          | null)
      : null;
    const ownerId = course?.userId;
    const owner =
      ownerId != null
        ? ((await User.findById(ownerId).select("email").lean()) as
            | { email?: string }
            | null)
        : null;

    const [segmentCount, factCount, cardCount] = await Promise.all([
      TranscriptSegment.countDocuments({ lectureId: input.lectureId }),
      Fact.countDocuments({ lectureId: input.lectureId }),
      Card.countDocuments({ lectureId: input.lectureId }),
    ]);

    const desc = `[system_error:${input.stage}] ${input.errorMessage}`.slice(
      0,
      4000
    );

    await BugReport.create({
      userId: ownerId ?? undefined,
      userEmail: owner?.email ?? undefined,
      lectureId: lecture._id,
      courseId: lecture.courseId,
      description: desc,
      processingStatus: lecture.processingStatus,
      segmentCount,
      factCount,
      cardCount,
      environment: envLabel(),
      source: "system_error",
      errorType: input.errorType ?? input.stage,
      errorMessage: input.errorMessage.slice(0, 2000),
      metadata: {
        stage: input.stage,
        processingAttemptCount: lecture.processingAttemptCount,
        currentRunId: lecture.currentRunId,
        ...input.metadata,
      },
      status: "new",
    });
  } catch (e) {
    console.error("recordPipelineSystemError failed", input.lectureId, e);
  }
}

export async function recordStaleRecoveryAbandoned(input: {
  lectureId: string;
  attempts: number;
}): Promise<void> {
  await recordPipelineSystemError({
    lectureId: input.lectureId,
    stage: "stale_recovery",
    errorMessage: `Lecture marked error after stale timeout (max attempts ${input.attempts})`,
    errorType: "stale_timeout",
    metadata: {
      reason: "stale_timeout_max_attempts",
      processingAttemptCount: input.attempts,
    },
  });
}

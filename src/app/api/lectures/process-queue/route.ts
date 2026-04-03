import { NextRequest, NextResponse } from "next/server";
import { runProcessQueueCycle } from "@/lib/lecture-pipeline/run-process-queue-cycle";
import { queueDiag } from "@/lib/lecture-pipeline/queue-diag-log";

/** Allow long runs on Vercel when configured. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  queueDiag("process_queue.POST.enter", {});
  const auth = request.headers.get("authorization");
  const secret = process.env.LECTURE_WORKER_SECRET;
  if (!secret) {
    queueDiag("process_queue.POST.auth_fail", { reason: "LECTURE_WORKER_SECRET_unset" });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (auth !== `Bearer ${secret}`) {
    queueDiag("process_queue.POST.auth_fail", {
      reason: "bearer_mismatch",
      hasAuthHeader: Boolean(auth),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  queueDiag("process_queue.POST.auth_ok", {});

  const {
    staleRecovery,
    processedLectureId,
    pipelineOk,
    pipelineError,
  } = await runProcessQueueCycle();

  queueDiag("process_queue.POST.done", {
    processedLectureId,
    pipelineOk,
    pipelineError,
  });

  return NextResponse.json({
    success: true,
    staleRecovery,
    processedLectureId,
    pipelineOk,
    pipelineError,
  });
}

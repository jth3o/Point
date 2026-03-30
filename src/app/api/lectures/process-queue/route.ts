import { NextRequest, NextResponse } from "next/server";
import { runProcessQueueCycle } from "@/lib/lecture-pipeline/run-process-queue-cycle";

/** Allow long runs on Vercel when configured. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.LECTURE_WORKER_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    staleRecovery,
    processedLectureId,
    pipelineOk,
    pipelineError,
  } = await runProcessQueueCycle();

  return NextResponse.json({
    success: true,
    staleRecovery,
    processedLectureId,
    pipelineOk,
    pipelineError,
  });
}

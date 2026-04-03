import { unstable_after } from "next/server";
import { queueDiag } from "@/lib/lecture-pipeline/queue-diag-log";

/**
 * When LECTURE_WORKER_SECRET is set, prefer HTTP to /api/lectures/process-queue so work runs in a
 * fresh serverless invocation (unstable_after alone is often dropped after the response returns).
 * Without a secret, use unstable_after or inline await from {@link kickQueueAfterLectureMutation}.
 */
export function triggerLectureWorker(): void {
  const secret = process.env.LECTURE_WORKER_SECRET;
  if (secret) {
    queueDiag("triggerLectureWorker", {
      path: "http_nudge",
      hasSecret: true,
    });
    nudgeQueueViaHttp();
    return;
  }

  queueDiag("triggerLectureWorker", {
    path: "unstable_after",
    hasSecret: false,
  });
  try {
    unstable_after(() => {
      queueDiag("triggerLectureWorker.after_callback_start", {});
      void import("@/lib/lecture-pipeline/run-process-queue-cycle")
        .then(({ runProcessQueueCycle }) => runProcessQueueCycle())
        .then((result) =>
          queueDiag("triggerLectureWorker.after_callback_done", {
            processedLectureId: result.processedLectureId,
            pipelineOk: result.pipelineOk,
            pipelineError: result.pipelineError,
          })
        )
        .catch((e) => {
          queueDiag("triggerLectureWorker.after_callback_error", {
            message: e instanceof Error ? e.message : String(e),
          });
          console.error("runProcessQueueCycle (unstable_after)", e);
        });
    });
  } catch (e) {
    queueDiag("triggerLectureWorker.unstable_after_register_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    void import("@/lib/lecture-pipeline/run-process-queue-cycle")
      .then(({ runProcessQueueCycle }) => runProcessQueueCycle())
      .catch((err) => console.error("runProcessQueueCycle fallback", err));
  }
}

/** Chain another worker invocation over HTTP (Bearer secret). */
export function nudgeQueueViaHttp(): void {
  const secret = process.env.LECTURE_WORKER_SECRET;
  if (!secret) {
    queueDiag("nudgeQueueViaHttp.skipped", { reason: "no_LECTURE_WORKER_SECRET" });
    return;
  }
  const url = `${getLectureWorkerBaseUrl()}/api/lectures/process-queue`;
  queueDiag("nudgeQueueViaHttp.fetch_start", { url: url.replace(/\/\/.*@/, "//***@") });
  void fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })
    .then(async (r) => {
      const bodyPreview = await r.text().then((t) => t.slice(0, 300)).catch(() => "");
      queueDiag("nudgeQueueViaHttp.fetch_done", {
        status: r.status,
        ok: r.ok,
        bodyPreview: bodyPreview || undefined,
      });
    })
    .catch((e) => {
      queueDiag("nudgeQueueViaHttp.fetch_error", {
        message: e instanceof Error ? e.message : String(e),
      });
      console.error("nudgeQueueViaHttp fetch failed", e);
    });
}

/**
 * Call after creating or mutating a lecture that should start processing.
 * With secret: fire HTTP worker (non-blocking). Without: await one in-process cycle (local dev).
 */
export async function kickQueueAfterLectureMutation(): Promise<void> {
  if (process.env.LECTURE_WORKER_SECRET) {
    queueDiag("kickQueueAfterLectureMutation", { path: "http_nudge" });
    nudgeQueueViaHttp();
    return;
  }
  queueDiag("kickQueueAfterLectureMutation", { path: "inline_await_cycle" });
  const { runProcessQueueCycle } = await import(
    "@/lib/lecture-pipeline/run-process-queue-cycle"
  );
  const result = await runProcessQueueCycle();
  queueDiag("kickQueueAfterLectureMutation.inline_done", {
    processedLectureId: result.processedLectureId,
    pipelineOk: result.pipelineOk,
    pipelineError: result.pipelineError,
  });
}

export function getLectureWorkerBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

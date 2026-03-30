import { unstable_after } from "next/server";

/**
 * Schedule one process-queue cycle after the current response is sent.
 * Avoids relying on self-HTTP for the first job (works without LECTURE_WORKER_SECRET on upload).
 *
 * When more lectures stay queued, {@link nudgeQueueViaHttp} + POST /api/lectures/process-queue
 * chains additional runs if LECTURE_WORKER_SECRET is set (recommended for serverless).
 */
export function triggerLectureWorker(): void {
  unstable_after(() => {
    void import("@/lib/lecture-pipeline/run-process-queue-cycle")
      .then(({ runProcessQueueCycle }) => runProcessQueueCycle())
      .catch((e) => console.error("runProcessQueueCycle (unstable_after)", e));
  });
}

/** Chain another worker invocation over HTTP (Bearer secret). */
export function nudgeQueueViaHttp(): void {
  const secret = process.env.LECTURE_WORKER_SECRET;
  if (!secret) return;
  const url = `${getLectureWorkerBaseUrl()}/api/lectures/process-queue`;
  void fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }).catch((e) => console.error("nudgeQueueViaHttp fetch failed", e));
}

export function getLectureWorkerBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

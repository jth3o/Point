/**
 * Fire-and-forget HTTP trigger for the lecture process-queue worker (no user session).
 * Does not await the worker response so callers return immediately while processing runs in another request.
 */
export function getLectureWorkerBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function triggerLectureWorker(): void {
  const secret = process.env.LECTURE_WORKER_SECRET;
  if (!secret) {
    console.warn(
      "LECTURE_WORKER_SECRET not set; lecture process-queue will not be triggered via HTTP"
    );
    return;
  }
  const url = `${getLectureWorkerBaseUrl()}/api/lectures/process-queue`;
  void fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }).catch((e) => console.error("triggerLectureWorker fetch failed", e));
}

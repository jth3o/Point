/**
 * Minimal structured logs for pipeline timing and counts (server logs only).
 */

export function logPipeline(
  stage: string,
  lectureId: string,
  data: Record<string, string | number | boolean | null | undefined>
): void {
  const payload = {
    tag: "point:pipeline",
    stage,
    lectureId,
    ...data,
    at: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
}

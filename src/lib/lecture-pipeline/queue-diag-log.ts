/**
 * Structured logs for lecture queue debugging. Search logs for `[lecture-queue]`.
 */
export function queueDiag(phase: string, payload: Record<string, unknown>): void {
  try {
    console.info("[lecture-queue]", phase, JSON.stringify(payload));
  } catch {
    console.info("[lecture-queue]", phase, payload);
  }
}

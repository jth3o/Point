/**
 * Light cleaning of transcript text without losing information.
 * Removes obvious noise (repeated timestamps, extra whitespace) but preserves content.
 */

export function cleanTranscriptText(raw: string): string {
  let out = raw
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " ") // dash artifacts from speech
    .trim();
  // Remove standalone timestamps like [00:01:23] or (00:01:23)
  out = out.replace(/\s*[\[\(]\d{1,2}:\d{2}(:\d{2})?[\]\)]\s*/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

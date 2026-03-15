/**
 * Deterministic VTT cue parser.
 * Extracts cue start time, end time, and text from WebVTT content.
 * Does not strip content; cleaning is done separately.
 */

export interface VttCue {
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
}

const WEBVTT_HEADER = "WEBVTT";
const TIME_RANGE =
  /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/;

function parseTimestamp(ts: string): number {
  const match = ts.trim().match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;

  const [, h, m, s, ms] = match;

  return (
    parseInt(h!, 10) * 3600 +
    parseInt(m!, 10) * 60 +
    parseInt(s!, 10) +
    parseInt(ms!, 10) / 1000
  );
}

/**
 * Parse WebVTT content into an array of cues.
 * Assumes input is valid .vtt; invalid lines are skipped.
 */
export function parseVtt(vttContent: string): VttCue[] {
  const lines = vttContent.split(/\r?\n/);
  const cues: VttCue[] = [];
  let i = 0;

  // Skip optional BOM
  if (lines[i]?.startsWith("\uFEFF")) {
    lines[i] = lines[i].slice(1);
  }

  // Skip WEBVTT header
  if (lines[i]?.trim().toUpperCase() === WEBVTT_HEADER) {
    i++;
  }

  while (i < lines.length) {
    const currentLine = lines[i]?.trim();

    // Skip blank lines
    if (!currentLine) {
      i++;
      continue;
    }

    // Skip NOTE / STYLE / REGION blocks if present
    if (
      currentLine.startsWith("NOTE") ||
      currentLine.startsWith("STYLE") ||
      currentLine.startsWith("REGION")
    ) {
      i++;
      while (i < lines.length && lines[i]?.trim()) {
        i++;
      }
      continue;
    }

    // Some VTT files may include a cue identifier line before the time range
    let timeLine = currentLine;
    let timeMatch = timeLine.match(TIME_RANGE);

    if (!timeMatch && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine) {
        const nextMatch = nextLine.match(TIME_RANGE);
        if (nextMatch) {
          i++;
          timeLine = nextLine;
          timeMatch = nextMatch;
        }
      }
    }

    if (!timeMatch) {
      i++;
      continue;
    }

    const startTime = parseTimestamp(timeMatch[1]!);
    const endTime = parseTimestamp(timeMatch[2]!);

    i++;

    const textLines: string[] = [];
    while (i < lines.length && lines[i]?.trim()) {
      textLines.push(lines[i]!.trim());
      i++;
    }

    const text = textLines.join(" ").trim();

    if (text) {
      cues.push({ startTime, endTime, text });
    }
  }

  return cues;
}
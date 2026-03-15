/**
 * Returns true if the card should be rejected as context-dependent (lecture/example-dependent).
 * Used to filter generated cards before saving so only self-contained, exam-style cards are stored.
 */

const LOWER_FRONT = (f: string) => f.toLowerCase().trim();
const LOWER_BACK = (b: string) => b.toLowerCase().trim();

/** Phrases that almost always indicate lecture-scene or undefined context. Reject if present. */
const ALWAYS_FORBIDDEN = [
  "in the lecture",
  "in this example",
  "in the weather example",
  "in the gas prices example",
  "weather-state coding",
  "weather state coding",
  "what is being discussed",
  "what is happening here",
  "what does this mean here",
  "what was said",
  "what was mentioned",
  "the professor",
  "this lecture",
  "the class",
  "the example above",
  "what was discussed",
  "as mentioned",
  "in the example",
  "in the coding",
] as const;

/** Pattern: "in the [something] example" (e.g. "in the weather example") */
const IN_THE_X_EXAMPLE = /\bin\s+the\s+\w+\s+example\b/i;

/** Numbered states or transition notation without definition. */
const STATE_OR_MATRIX = /\b(state\s+[0-3]|P_0[0-9]|P_1[0-9])\b/i;
/** Card has explicit mapping/definition for states or symbols (e.g. "0 = sunny", "state 0 represent", "P_00 is"). */
const HAS_EXPLICIT_MAPPING = /(\b[0-3]\s*=\s*\S+|\bstate\s+[0-3]\s*(=|represent|denote|means?|is\s)|P_0[0-9]\s*(=|represent|denote|means?|is\s)|encoding\s*:|\bwhere\s+[0-3]\s*=)/i;

/** "coding" in a context that suggests undefined encoding (e.g. "weather-state coding" without definition). */
const CODING_WITHOUT_SETUP = /\b(weather[- ]?state|state)\s+coding\b/i;
const HAS_CODING_SETUP = /(\b(encoding|state)\s*(:|\s+is\s+|\s+=\s+)|0\s*=\s*\w+|1\s*=\s*\w+|state\s+0\s+represent)/i;

export function isContextDependentCard(front: string, back: string): boolean {
  const f = LOWER_FRONT(front);
  const b = LOWER_BACK(back);
  const combined = `${f} ${b}`;

  for (const phrase of ALWAYS_FORBIDDEN) {
    if (f.includes(phrase) || b.includes(phrase)) return true;
  }

  if (IN_THE_X_EXAMPLE.test(front) || IN_THE_X_EXAMPLE.test(back)) return true;

  if (STATE_OR_MATRIX.test(combined) && !HAS_EXPLICIT_MAPPING.test(combined)) return true;

  if (CODING_WITHOUT_SETUP.test(combined) && !HAS_CODING_SETUP.test(combined)) return true;

  if (/\bstate\s+[0-3]\b/i.test(combined) && !HAS_EXPLICIT_MAPPING.test(combined)) return true;

  return false;
}

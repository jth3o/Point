/**
 * Point self-contained-card rubric (validation enforces the reject criteria below).
 *
 * A valid card must be:
 * 1. self-contained
 * 2. atomic
 * 3. explicit in its setup when needed
 * 4. recall-worthy
 * 5. clearly answerable
 *
 * Reject if:
 * - depends on lecture context
 * - depends on another card
 * - uses undefined notation, labels, symbols, or encodings
 * - refers to hidden figures/tables/examples/models
 * - tests low-value trivia (handled mainly in prompt)
 * - tests more than one idea at once (handled mainly in prompt)
 *
 * Returns true when the card should be rejected (fails one or more criteria).
 */

const LOWER = (s: string) => s.toLowerCase().trim();

// —— Depends on lecture context ———
const LECTURE_CONTEXT = [
  "in the lecture",
  "this lecture",
  "the class",
  "the professor",
  "what was said",
  "what was mentioned",
  "what was discussed",
  "what is being discussed",
  "what is happening here",
  "what does this mean here",
  "as mentioned",
  "in the example",
  "in this example",
  "from the lecture",
  "from this lecture",
  "from the example",
  "from the transcript",
] as const;

// —— Depends on another card / sequence ———
const CROSS_CARD = [
  "previous card",
  "previous cards",
  "earlier card",
  "earlier cards",
  "see above",
  "as above",
  "as shown above",
  "refer to the above",
  "from the above",
  "from above",
  "in the card above",
  "in the question above",
  "the example above",
  "from the previous",
  "from the earlier",
  "given the context above",
  "in this context",
  "in that context",
] as const;

// —— Undefined notation/labels/symbols/encodings (reference without definition in card) ———
const UNDEFINED_REF = /\b(the|this|that)\s+(symbol|variable|label|encoding|notation)\b/i;

// —— Hidden figures/tables/examples/models ———
const NAMED_EXAMPLE_REF = /\bin\s+the\s+\w+\s+example\b/i;
const HIDDEN_FIGURE_OR_MODEL = /\b(the|this|that)\s+(example|context|setup|model|diagram|figure|table|matrix|graph)\b/i;
const REFER_ELSEWHERE = /\b(refer to|see|as in)\s+(the\s+)?(following|below)\b/i;

// —— Not self-contained (options or list not in card) ———
const IMPLIED_EXTERNAL_LIST = /\bwhich\s+of\s+the\s+following\b/i;

export function isContextDependentCard(front: string, back: string): boolean {
  const f = LOWER(front);
  const b = LOWER(back);

  for (const phrase of LECTURE_CONTEXT) {
    if (f.includes(phrase) || b.includes(phrase)) return true;
  }

  for (const phrase of CROSS_CARD) {
    if (f.includes(phrase) || b.includes(phrase)) return true;
  }

  if (UNDEFINED_REF.test(front) || UNDEFINED_REF.test(back)) return true;
  if (NAMED_EXAMPLE_REF.test(front) || NAMED_EXAMPLE_REF.test(back)) return true;
  if (HIDDEN_FIGURE_OR_MODEL.test(front) || HIDDEN_FIGURE_OR_MODEL.test(back)) return true;
  if (REFER_ELSEWHERE.test(front) || REFER_ELSEWHERE.test(back)) return true;
  if (IMPLIED_EXTERNAL_LIST.test(front) || IMPLIED_EXTERNAL_LIST.test(back)) return true;

  return false;
}

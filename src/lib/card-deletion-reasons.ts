/**
 * Fixed delete reasons for card removal (analytics / product improvement).
 */

export const CARD_DELETE_REASONS = [
  "not_relevant",
  "incorrect_information",
  "bad_wording",
] as const;

export type CardDeleteReason = (typeof CARD_DELETE_REASONS)[number];

export const CARD_DELETE_REASON_LABELS: Record<CardDeleteReason, string> = {
  not_relevant: "Not relevant",
  incorrect_information: "Incorrect information",
  bad_wording: "Bad wording",
};

export function parseCardDeleteReason(value: unknown): CardDeleteReason | null {
  if (typeof value !== "string") return null;
  return (CARD_DELETE_REASONS as readonly string[]).includes(value)
    ? (value as CardDeleteReason)
    : null;
}

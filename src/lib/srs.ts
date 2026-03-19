/**
 * Point simplified Anki-like scheduler (backend-only).
 *
 * State machine:
 * - new → learning (step1/step2) → review
 * - review again → relearning
 * - relearning transitions back to review
 *
 * Times:
 * - learning step1: 1 minute
 * - learning step2: 10 minutes
 * - review again/relearning again: 10 minutes
 */

import type { ReviewStateType } from "@/models/ReviewState";
import type { Rating } from "@/models/ReviewLog";

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

// learning steps: 0 -> step1 (1m), 1 -> step2 (10m)
const LEARNING_STEP1_MINUTES = 1;
const LEARNING_STEP2_MINUTES = 10;

// new behavior
const NEW_EASY_DAYS = 3; // new easy -> review in 3 days

// learning behavior
const LEARNING_STEP2_GOOD_GRADUATE_DAYS = 1; // learning step2 good -> review in 1 day

// relearning/review behavior
const REVIEW_AGAIN_TO_RELEARNING_MINUTES = 10; // review again -> relearning in 10 minutes
const RELEARNING_AGAIN_MINUTES = 10; // relearning again -> 10 minutes

const REVIEW_HARD_MULTIPLIER = 1.2;
const REVIEW_EASY_MULTIPLIER = 1.3;

const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

export interface SRSInput {
  state: ReviewStateType;
  learningStep: number; // 0|1: step1/step2
  reps: number;
  lapseCount: number;
  intervalDays: number;
  easeFactor: number;
  rating: Rating;
}

export interface SRSOutput {
  state: ReviewStateType;
  learningStep: number;
  reps: number;
  lapseCount: number;
  intervalDays: number;
  easeFactor: number;
  nextDueAt: Date;
}

function addMinutes(d: Date, minutes: number): Date {
  const out = new Date(d);
  out.setMinutes(out.getMinutes() + minutes);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function roundInt(n: number): number {
  return Math.round(n);
}

function clampEase(v: number): number {
  return Math.max(MIN_EASE, v);
}

function adjustEaseFactor(oldEase: number, rating: Rating): number {
  const current = typeof oldEase === "number" ? oldEase : DEFAULT_EASE;
  switch (rating) {
    case "again":
      return clampEase(current - 0.2);
    case "hard":
      return clampEase(current - 0.1);
    case "good":
      return current;
    case "easy":
      return current + 0.1;
  }
}

/** Human-readable interval from now to nextDue (MVP-friendly). */
export function formatIntervalLabel(now: Date, nextDue: Date): string {
  const ms = nextDue.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const days = Math.round(ms / 86400000);
  return `${Math.max(1, days)}d`;
}

export function computeNextReview(now: Date, input: SRSInput): SRSOutput {
  const {
    state,
    learningStep,
    reps,
    lapseCount,
    intervalDays,
    easeFactor,
    rating,
  } = input;

  const nextReps = reps + 1;
  const nextEase = adjustEaseFactor(easeFactor, rating);

  const step = learningStep === 1 ? 1 : 0; // clamp
  const safeInterval = typeof intervalDays === "number" ? intervalDays : 0;

  // ——— new ———
  if (state === "new") {
    switch (rating) {
      case "again":
        return {
          state: "learning",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: nextEase,
          nextDueAt: addMinutes(now, LEARNING_STEP1_MINUTES),
        };
      case "hard":
        return {
          state: "learning",
          learningStep: 1,
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: nextEase,
          nextDueAt: addMinutes(now, LEARNING_STEP2_MINUTES),
        };
      case "good":
        return {
          state: "learning",
          learningStep: 1,
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: nextEase,
          nextDueAt: addMinutes(now, LEARNING_STEP2_MINUTES),
        };
      case "easy":
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: NEW_EASY_DAYS,
          easeFactor: nextEase,
          nextDueAt: addDays(now, NEW_EASY_DAYS),
        };
    }
  }

  // ——— learning ———
  if (state === "learning") {
    if (step === 0) {
      // learning step1
      switch (rating) {
        case "again":
          return {
            state: "learning",
            learningStep: 0,
            reps: nextReps,
            lapseCount,
            intervalDays: 0,
            easeFactor: nextEase,
            nextDueAt: addMinutes(now, LEARNING_STEP1_MINUTES),
          };
        case "hard":
          return {
            state: "learning",
            learningStep: 1,
            reps: nextReps,
            lapseCount,
            intervalDays: 0,
            easeFactor: nextEase,
            nextDueAt: addMinutes(now, LEARNING_STEP2_MINUTES),
          };
        case "good":
          return {
            state: "learning",
            learningStep: 1,
            reps: nextReps,
            lapseCount,
            intervalDays: 0,
            easeFactor: nextEase,
            nextDueAt: addMinutes(now, LEARNING_STEP2_MINUTES),
          };
        case "easy":
          return {
            state: "review",
            learningStep: 0,
            reps: nextReps,
            lapseCount,
            intervalDays: NEW_EASY_DAYS,
            easeFactor: nextEase,
            nextDueAt: addDays(now, NEW_EASY_DAYS),
          };
      }
    }

    // learning step2
    switch (rating) {
      case "again":
        return {
          state: "learning",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: nextEase,
          nextDueAt: addMinutes(now, LEARNING_STEP1_MINUTES),
        };
      case "hard":
        return {
          state: "learning",
          learningStep: 1,
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: nextEase,
          nextDueAt: addMinutes(now, LEARNING_STEP2_MINUTES),
        };
      case "good":
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: LEARNING_STEP2_GOOD_GRADUATE_DAYS,
          easeFactor: nextEase,
          nextDueAt: addDays(now, LEARNING_STEP2_GOOD_GRADUATE_DAYS),
        };
      case "easy":
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: NEW_EASY_DAYS,
          easeFactor: nextEase,
          nextDueAt: addDays(now, NEW_EASY_DAYS),
        };
    }
  }

  // ——— review ———
  if (state === "review") {
    switch (rating) {
      case "again":
        return {
          state: "relearning",
          learningStep: 0,
          reps: nextReps,
          lapseCount: lapseCount + 1,
          intervalDays: safeInterval,
          easeFactor: nextEase,
          nextDueAt: addMinutes(now, REVIEW_AGAIN_TO_RELEARNING_MINUTES),
        };
      case "hard": {
        const nextInterval = Math.max(
          1,
          roundInt(safeInterval * REVIEW_HARD_MULTIPLIER)
        );
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: nextInterval,
          easeFactor: nextEase,
          nextDueAt: addDays(now, nextInterval),
        };
      }
      case "good": {
        const nextInterval = Math.max(1, roundInt(safeInterval * nextEase));
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: nextInterval,
          easeFactor: nextEase,
          nextDueAt: addDays(now, nextInterval),
        };
      }
      case "easy": {
        const nextInterval = Math.max(
          2,
          roundInt(safeInterval * nextEase * REVIEW_EASY_MULTIPLIER)
        );
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: nextInterval,
          easeFactor: nextEase,
          nextDueAt: addDays(now, nextInterval),
        };
      }
    }
  }

  // ——— relearning ———
  if (state === "relearning") {
    switch (rating) {
      case "again":
        return {
          state: "relearning",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: safeInterval,
          easeFactor: nextEase,
          nextDueAt: addMinutes(now, RELEARNING_AGAIN_MINUTES),
        };
      case "hard":
        return {
          state: "relearning",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: 1,
          easeFactor: nextEase,
          nextDueAt: addDays(now, 1),
        };
      case "good":
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: 1,
          easeFactor: nextEase,
          nextDueAt: addDays(now, 1),
        };
      case "easy":
        return {
          state: "review",
          learningStep: 0,
          reps: nextReps,
          lapseCount,
          intervalDays: 3,
          easeFactor: nextEase,
          nextDueAt: addDays(now, 3),
        };
    }
  }

  // Fallback
  return {
    state: "learning",
    learningStep: 0,
    reps: nextReps,
    lapseCount,
    intervalDays: 0,
    easeFactor: nextEase,
    nextDueAt: addMinutes(now, LEARNING_STEP1_MINUTES),
  };
}

export function getRatingPreviews(
  now: Date,
  base: Omit<SRSInput, "rating">
): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const r of RATINGS) {
    const next = computeNextReview(now, { ...base, rating: r });
    out[r] = formatIntervalLabel(now, next.nextDueAt);
  }
  return out;
}

/** For cards we never saw before, seed nextDueAt so they are selected as "new". */
export function getInitialNextDueAt(): Date {
  return new Date(0);
}

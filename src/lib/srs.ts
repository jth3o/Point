/**
 * Simple Anki-inspired SRS scheduler for MVP.
 * Isolated so it can be replaced or tuned later without touching routes.
 */

import type { ReviewStateType } from "@/models/ReviewState";
import type { Rating } from "@/models/ReviewLog";

const MIN_INTERVAL_DAYS = 1;
const LEARNING_STEP_MINUTES = [1, 5, 10]; // Again -> 1m, Hard -> 5m, Good -> 10m
const REVIEW_AGAIN_FACTOR = 0.2;
const REVIEW_HARD_FACTOR = 1.2;
const REVIEW_GOOD_FACTOR = 2;
const REVIEW_EASY_FACTOR = 2.5;
const DEFAULT_EASE = 2.5;

export interface SRSInput {
  state: ReviewStateType;
  reps: number;
  lapseCount: number;
  intervalDays: number;
  easeFactor: number;
  rating: Rating;
}

export interface SRSOutput {
  state: ReviewStateType;
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

export function computeNextReview(now: Date, input: SRSInput): SRSOutput {
  const { state, reps, lapseCount, intervalDays, easeFactor, rating } = input;
  const nextReps = reps + 1;

  if (state === "new") {
    switch (rating) {
      case "again":
        return {
          state: "learning",
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: DEFAULT_EASE,
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[0]),
        };
      case "hard":
        return {
          state: "learning",
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: DEFAULT_EASE,
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[1]),
        };
      case "good":
        return {
          state: "learning",
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor: DEFAULT_EASE,
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[2]),
        };
      case "easy":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: 4,
          easeFactor: DEFAULT_EASE,
          nextDueAt: addDays(now, 4),
        };
    }
  }

  if (state === "learning") {
    switch (rating) {
      case "again":
        return {
          state: "learning",
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor,
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[0]),
        };
      case "hard":
        return {
          state: "learning",
          reps: nextReps,
          lapseCount,
          intervalDays: 0,
          easeFactor,
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[1]),
        };
      case "good":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: MIN_INTERVAL_DAYS,
          easeFactor,
          nextDueAt: addDays(now, MIN_INTERVAL_DAYS),
        };
      case "easy":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: 4,
          easeFactor,
          nextDueAt: addDays(now, 4),
        };
    }
  }

  if (state === "review") {
    const nextIntervalAgain = Math.max(MIN_INTERVAL_DAYS, Math.floor(intervalDays * REVIEW_AGAIN_FACTOR));
    switch (rating) {
      case "again":
        return {
          state: "relearning",
          reps: nextReps,
          lapseCount: lapseCount + 1,
          intervalDays: nextIntervalAgain,
          easeFactor: Math.max(1.3, easeFactor - 0.2),
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[0]),
        };
      case "hard":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: Math.max(MIN_INTERVAL_DAYS, Math.floor(intervalDays * REVIEW_HARD_FACTOR)),
          easeFactor,
          nextDueAt: addDays(now, Math.max(MIN_INTERVAL_DAYS, Math.floor(intervalDays * REVIEW_HARD_FACTOR))),
        };
      case "good":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: Math.max(MIN_INTERVAL_DAYS, Math.floor(intervalDays * REVIEW_GOOD_FACTOR)),
          easeFactor,
          nextDueAt: addDays(now, Math.max(MIN_INTERVAL_DAYS, Math.floor(intervalDays * REVIEW_GOOD_FACTOR))),
        };
      case "easy":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: Math.max(MIN_INTERVAL_DAYS, Math.floor(intervalDays * REVIEW_EASY_FACTOR)),
          easeFactor,
          nextDueAt: addDays(now, Math.max(MIN_INTERVAL_DAYS, Math.floor(intervalDays * REVIEW_EASY_FACTOR))),
        };
    }
  }

  if (state === "relearning") {
    switch (rating) {
      case "again":
        return {
          state: "relearning",
          reps: nextReps,
          lapseCount,
          intervalDays,
          easeFactor,
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[0]),
        };
      case "hard":
        return {
          state: "relearning",
          reps: nextReps,
          lapseCount,
          intervalDays,
          easeFactor,
          nextDueAt: addMinutes(now, LEARNING_STEP_MINUTES[1]),
        };
      case "good":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: Math.max(MIN_INTERVAL_DAYS, intervalDays),
          easeFactor,
          nextDueAt: addDays(now, Math.max(MIN_INTERVAL_DAYS, intervalDays)),
        };
      case "easy":
        return {
          state: "review",
          reps: nextReps,
          lapseCount,
          intervalDays: Math.max(4, intervalDays),
          easeFactor,
          nextDueAt: addDays(now, Math.max(4, intervalDays)),
        };
    }
  }

  return {
    state: "learning",
    reps: nextReps,
    lapseCount,
    intervalDays: 0,
    easeFactor: DEFAULT_EASE,
    nextDueAt: addMinutes(now, 1),
  };
}

/** For new cards we need an initial ReviewState with nextDueAt = epoch so they appear due. */
export function getInitialNextDueAt(): Date {
  return new Date(0);
}

/**
 * Study session queue: priority relearning → learning → review → new,
 * with a dynamic session cap and scaled new-card exposure when backlog is large.
 */

/** Hard upper bound so a single session does not explode. */
export const STUDY_SESSION_MAX = 55;

/**
 * How many "new" cards to allow in this session (before daily cap).
 * Scales with unseen/due new count N: larger backlog → more new cards per session,
 * capped per session so we do not use a flat tiny limit for every course.
 */
export function computeScaledNewTake(N: number, newSlotsLeft: number): number {
  if (N <= 0 || newSlotsLeft <= 0) return 0;
  // ~18% of due-new backlog per session, floor 5, ceiling 30 (then min with daily slots + N)
  const dynamic = Math.min(30, Math.max(5, Math.floor(5 + N * 0.18)));
  return Math.min(N, newSlotsLeft, dynamic);
}

/**
 * Target session size: all priority buckets we intend to pull from this session,
 * capped at STUDY_SESSION_MAX.
 */
export function computeSessionCap(
  R: number,
  L: number,
  Rev: number,
  newTake: number
): number {
  return Math.min(STUDY_SESSION_MAX, R + L + Rev + newTake);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Fill queue in state priority, stopping at `sessionCap` cards.
 * New cards: at most `newTake` from `newCards` (already shuffled selection by caller).
 */
export function buildPriorityStudyQueue<T>(
  relearning: T[],
  learning: T[],
  reviewDue: T[],
  newCards: T[],
  sessionCap: number,
  newTake: number,
  options?: { shuffleNew?: boolean }
): T[] {
  const q: T[] = [];

  const takeBucket = (arr: T[]) => {
    for (const item of shuffleArray(arr)) {
      if (q.length >= sessionCap) return;
      q.push(item);
    }
  };

  takeBucket(relearning);
  takeBucket(learning);
  takeBucket(reviewDue);

  const newShuffled =
    options?.shuffleNew === false ? newCards : shuffleArray(newCards);
  for (let i = 0; i < newTake && q.length < sessionCap; i++) {
    const item = newShuffled[i];
    if (item === undefined) break;
    q.push(item);
  }

  return q;
}

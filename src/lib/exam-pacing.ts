/**
 * Exam week: within 7 UTC days of the next exam (including exam day), pacing limits relax.
 */

export const EXAM_WEEK_DAYS = 7;

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** True when `nextExamDate` is today through 7 calendar days ahead (UTC). Past dates → false. */
export function isCourseInExamWeek(
  nextExamDate: Date | undefined | null,
  now: Date
): boolean {
  if (!nextExamDate) return false;
  const exam = startOfUtcDay(new Date(nextExamDate));
  const today = startOfUtcDay(now);
  const diffDays = Math.round(
    (exam.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
  return diffDays >= 0 && diffDays <= EXAM_WEEK_DAYS;
}

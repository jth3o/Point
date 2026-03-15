"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Course = { _id: string; title: string };
type LectureWithCounts = { _id: string; cardCount?: number };
type CourseSummary = {
  _id: string;
  title: string;
  lectureCount: number;
  cardCount: number;
  dueCount: number;
};

export function StudyCoursePicker() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const cres = await fetch("/api/courses");
        if (!cres.ok) throw new Error("Failed to load courses");
        const courseList: Course[] = await cres.json();
        const summaries: CourseSummary[] = [];
        for (const c of courseList) {
          const [lres, dres] = await Promise.all([
            fetch(`/api/courses/${c._id}/lectures`),
            fetch(`/api/review/due?courseId=${c._id}`),
          ]);
          const lectures: LectureWithCounts[] = lres.ok ? await lres.json() : [];
          const dueCards: unknown[] = dres.ok ? await dres.json() : [];
          const cardCount = lectures.reduce((s, l) => s + (l.cardCount ?? 0), 0);
          summaries.push({
            _id: c._id,
            title: c.title,
            lectureCount: lectures.length,
            cardCount,
            dueCount: dueCards.length,
          });
        }
        if (!cancelled) setCourses(summaries);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-[var(--muted-foreground)] text-sm">Loading…</p>;
  if (error) return <p className="text-[var(--destructive)] text-sm">{error}</p>;
  if (courses.length === 0) {
    return (
      <p className="text-[var(--muted-foreground)] text-sm">
        No courses yet. Create a course and add lectures with cards from the Dashboard.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">Choose a course to study:</p>
      <ul className="space-y-2">
        {courses.map((c) => (
          <li key={c._id}>
            <Link
              href={`/study/${c._id}`}
              className="block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--accent)]"
            >
              <span className="font-medium">{c.title}</span>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {c.lectureCount} lecture{c.lectureCount !== 1 ? "s" : ""} · {c.cardCount} cards · {c.dueCount} due
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

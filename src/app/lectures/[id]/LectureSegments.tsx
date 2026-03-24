"use client";

import { useEffect, useState } from "react";

type Segment = {
  _id: string;
  sequence: number;
  startTime: number;
  endTime: number;
  rawText: string;
  cleanedText: string;
  topicLabel?: string;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LectureSegments({ lectureId }: { lectureId: string }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/lectures/${lectureId}/segments`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load segments");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSegments(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lectureId]);

  if (loading) return <p className="text-[var(--muted-foreground)] text-sm">Loading segments…</p>;
  if (error) return <p className="text-[var(--destructive)] text-sm">{error}</p>;
  if (segments.length === 0) {
    return (
      <p className="text-[var(--muted-foreground)] text-sm">
        No segments yet. Processing runs in the background after upload; if this stays empty,
        use Queue processing on the course page.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {segments.map((seg) => (
        <li
          key={seg._id}
          className="rounded-lg border border-[var(--border)] p-3 text-sm"
        >
          <div className="flex gap-2 text-xs text-[var(--muted-foreground)] mb-2">
            <span>#{seg.sequence}</span>
            <span>
              {formatTime(seg.startTime)} → {formatTime(seg.endTime)}
            </span>
          </div>
          <p className="whitespace-pre-wrap">{seg.cleanedText}</p>
        </li>
      ))}
    </ul>
  );
}

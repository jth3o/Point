"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Summary = {
  processingStatus: string;
  segmentCount: number;
  factCount: number;
  cardCount: number;
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  parsing: "Parsing…",
  parsed: "Parsed",
  segmenting: "Segmenting…",
  segmented: "Segmented",
  extracting: "Extracting…",
  extracted: "Extracted",
  facts_ready: "Facts ready",
  generating_cards: "Generating cards…",
  ready: "Ready",
  error: "Error",
};

export function LectureSummary({
  lectureId,
  lectureTitle,
  courseId,
}: {
  lectureId: string;
  lectureTitle: string;
  courseId: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/lectures/${lectureId}/summary`);
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when lectureId changes
  }, [lectureId]);

  const runPipelineToFacts = async () => {
    setProcessing(true);
    try {
      await fetch(`/api/lectures/${lectureId}/parse-vtt`, { method: "POST" });
      await fetch(`/api/lectures/${lectureId}/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetch(`/api/lectures/${lectureId}/extract-facts`, { method: "POST" });
      await fetchSummary();
    } finally {
      setProcessing(false);
    }
  };

  const runGenerateCards = async () => {
    setProcessing(true);
    try {
      await fetch(`/api/lectures/${lectureId}/generate-cards`, { method: "POST" });
      await fetchSummary();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lecture-processed", { detail: { lectureId } }));
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <p className="text-[var(--muted-foreground)] text-sm">Loading…</p>;

  const statusLabel = summary
    ? STATUS_LABEL[summary.processingStatus] ?? summary.processingStatus
    : "—";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">{lectureTitle}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Status: {statusLabel}
            {summary && (
              <> · {summary.factCount} facts · {summary.cardCount} cards</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {summary?.processingStatus !== "ready" &&
            summary?.processingStatus !== "facts_ready" && (
              <Button
                size="sm"
                variant="outline"
                onClick={runPipelineToFacts}
                disabled={processing}
              >
                {processing ? "Processing…" : "Process"}
              </Button>
            )}
          {summary?.processingStatus === "facts_ready" && (
            <Button
              size="sm"
              variant="outline"
              onClick={runGenerateCards}
              disabled={processing}
            >
              {processing ? "Generating…" : "Generate cards"}
            </Button>
          )}
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/courses/${courseId}`}>← Course</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

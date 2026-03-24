"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Summary = {
  processingStatus: string;
  segmentCount: number;
  factCount: number;
  cardCount: number;
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Not processed",
  queued: "Queued",
  parsing: "Parsing…",
  parsed: "Parsed",
  segmenting: "Processing your lecture…",
  segmented: "Extracting key facts…",
  extracting: "Extracting key facts…",
  extracted: "Extracted",
  facts_ready: "Building your first cards…",
  generating_cards: "Building your deck…",
  generating_initial_cards: "Building your first cards…",
  generating_remaining_cards: "First cards ready · building the rest…",
  ready: "Deck complete",
  error: "Error",
};

const PIPELINE_BUSY = new Set([
  "segmenting",
  "segmented",
  "extracting",
  "generating_initial_cards",
  "generating_remaining_cards",
  "generating_cards",
]);

const BUSY = new Set([
  "queued",
  "segmenting",
  "segmented",
  "extracting",
  "facts_ready",
  "generating_cards",
  "generating_initial_cards",
  "generating_remaining_cards",
]);

function canShowRetry(processingStatus: string): boolean {
  return processingStatus !== "ready" && !PIPELINE_BUSY.has(processingStatus);
}

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
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const prevCardCount = useRef(0);

  useEffect(() => {
    prevCardCount.current = 0;
  }, [lectureId]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/lectures/${lectureId}/summary`);
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data);
      if (
        typeof data.cardCount === "number" &&
        data.cardCount > prevCardCount.current
      ) {
        prevCardCount.current = data.cardCount;
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("lecture-processed", { detail: { lectureId } })
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [lectureId]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (!summary?.processingStatus) return;
    if (!BUSY.has(summary.processingStatus)) return;
    const t = setInterval(() => {
      void fetchSummary();
    }, 2500);
    return () => clearInterval(t);
  }, [summary?.processingStatus, fetchSummary]);

  const queueProcessing = async () => {
    setRetrying(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/queue-processing`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to queue processing");
      }
      await fetchSummary();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <p className="text-[var(--muted-foreground)] text-sm">Loading…</p>;

  const statusLabel = summary
    ? STATUS_LABEL[summary.processingStatus] ?? summary.processingStatus
    : "—";

  const showProgressHint =
    summary &&
    BUSY.has(summary.processingStatus) &&
    summary.processingStatus !== "facts_ready";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">{lectureTitle}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {statusLabel}
            {summary && (
              <>
                {" "}
                · {summary.factCount} facts · {summary.cardCount} cards
              </>
            )}
          </p>
          {showProgressHint && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              You can leave this page; processing will continue. First cards may appear before the
              full deck is finished.
            </p>
          )}
          {actionError && (
            <p className="text-xs text-[var(--destructive)] mt-1">{actionError}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {summary && canShowRetry(summary.processingStatus) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void queueProcessing()}
              disabled={retrying}
            >
              {retrying
                ? "Queueing…"
                : summary.processingStatus === "error"
                  ? "Retry"
                  : "Queue processing"}
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

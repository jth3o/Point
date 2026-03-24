"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lecture = {
  _id: string;
  title: string;
  filename: string;
  uploadStatus: string;
  processingStatus: string;
  factCount?: number;
  cardCount?: number;
  createdAt: string;
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

/** Lecture is actively running the pipeline (not waiting in queue). */
const PIPELINE_BUSY = new Set([
  "segmenting",
  "segmented",
  "extracting",
  "generating_initial_cards",
  "generating_remaining_cards",
  "generating_cards",
]);

const POLL_STATUSES = new Set([
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

export function CourseLectureList({ courseId }: { courseId: string }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLectures = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/lectures`);
      if (!res.ok) throw new Error("Failed to load lectures");
      const data = await res.json();
      setLectures(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, [courseId]);

  useEffect(() => {
    void fetchLectures();
  }, [fetchLectures]);

  useEffect(() => {
    const needsPoll = lectures.some((l) => POLL_STATUSES.has(l.processingStatus));
    if (!needsPoll) return;
    const t = setInterval(() => {
      void fetchLectures({ silent: true });
    }, 2500);
    return () => clearInterval(t);
  }, [lectures, fetchLectures]);

  const queueProcessing = async (lectureId: string) => {
    setRetryingId(lectureId);
    setError(null);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/queue-processing`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to queue processing");
      }
      await fetchLectures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue processing");
    } finally {
      setRetryingId(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || uploading) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase();
        if (!name.endsWith(".vtt")) {
          setError("Only .vtt files are supported.");
          return;
        }
        const formData = new FormData();
        formData.set("file", file);
        formData.set("courseId", courseId);
        if (uploadTitle.trim()) formData.set("title", uploadTitle.trim());
        const res = await fetch("/api/lectures/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Upload failed");
        }
      }
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchLectures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteLecture = async (lectureId: string, title: string) => {
    if (
      !confirm(
        `Delete lecture "${title}"? This will remove the lecture, its transcript, facts, cards, and review data.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/lectures/${lectureId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchLectures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return <p className="text-[var(--muted-foreground)] text-sm">Loading lectures…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">File</label>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".vtt"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="max-w-xs"
          />
          <Input
            placeholder="Lecture title (optional)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="max-w-xs"
          />
          {uploading && (
            <span className="text-sm text-[var(--muted-foreground)]">Uploading…</span>
          )}
        </div>
      </div>
      {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}
      <div>
        <h3 className="text-sm font-medium mb-2">Lectures</h3>
        {lectures.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">No lectures yet.</p>
        ) : (
          <ul className="space-y-2">
            {lectures.map((lec) => (
              <li
                key={lec._id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{lec.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {lec.filename} · {STATUS_LABEL[lec.processingStatus] ?? lec.processingStatus}
                    {typeof lec.factCount === "number" && <> · {lec.factCount} facts</>}
                    {typeof lec.cardCount === "number" && <> · {lec.cardCount} cards</>}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {canShowRetry(lec.processingStatus) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void queueProcessing(lec._id)}
                      disabled={retryingId !== null}
                    >
                      {retryingId === lec._id
                        ? "Queueing…"
                        : lec.processingStatus === "error"
                          ? "Retry"
                          : "Queue processing"}
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/lectures/${lec._id}`}>View</Link>
                  </Button>
                  <button
                    type="button"
                    className="text-xs text-[var(--destructive)] hover:underline"
                    onClick={() => deleteLecture(lec._id, lec.title)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

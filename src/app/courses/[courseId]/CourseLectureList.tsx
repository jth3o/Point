"use client";

import { useEffect, useState, useRef } from "react";
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

export function CourseLectureList({
  courseId,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLectures = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/lectures`);
      if (!res.ok) throw new Error("Failed to load lectures");
      const data = await res.json();
      setLectures(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLectures is stable; only re-run when courseId changes
  }, [courseId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".vtt")) {
      setError("Only .vtt files are supported.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
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
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      const created = await res.json();
      await fetchLectures();
      if (created?._id) {
        runPipelineToFacts(created._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const runPipelineToFacts = async (lectureId: string) => {
    setProcessingId(lectureId);
    setError(null);
    try {
      let res = await fetch(`/api/lectures/${lectureId}/parse-vtt`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Parse failed");
      }
      res = await fetch(`/api/lectures/${lectureId}/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Segment failed");
      }
      res = await fetch(`/api/lectures/${lectureId}/extract-facts`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Extract facts failed");
      }
      await fetchLectures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessingId(null);
    }
  };

  const deleteLecture = async (lectureId: string, title: string) => {
    if (!confirm(`Delete lecture "${title}"? This will remove the lecture, its transcript, facts, cards, and review data.`)) return;
    try {
      const res = await fetch(`/api/lectures/${lectureId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchLectures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const runGenerateCards = async (lectureId: string) => {
    setProcessingId(lectureId);
    setError(null);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/generate-cards`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Generate cards failed");
      }
      await fetchLectures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate cards failed");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <p className="text-[var(--muted-foreground)] text-sm">Loading lectures…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">VTT file</label>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".vtt"
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
      {error && (
        <p className="text-[var(--destructive)] text-sm">{error}</p>
      )}
      <div>
        <h3 className="text-sm font-medium mb-2">Lectures</h3>
        {lectures.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">
            No lectures yet. Upload a .vtt file above.
          </p>
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
                    {typeof lec.factCount === "number" && (
                      <> · {lec.factCount} facts</>
                    )}
                    {typeof lec.cardCount === "number" && (
                      <> · {lec.cardCount} cards</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {lec.processingStatus !== "ready" &&
                    lec.processingStatus !== "facts_ready" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runPipelineToFacts(lec._id)}
                        disabled={processingId !== null}
                      >
                        {processingId === lec._id ? "Processing…" : "Process"}
                      </Button>
                    )}
                  {lec.processingStatus === "facts_ready" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runGenerateCards(lec._id)}
                      disabled={processingId !== null}
                    >
                      {processingId === lec._id ? "Generating…" : "Generate cards"}
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

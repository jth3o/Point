"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

type Summary = {
  processingStatus?: string;
  segmentCount?: number;
  factCount?: number;
  cardCount?: number;
};

export function ReportBugDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname() ?? "";
  const [description, setDescription] = useState("");
  const [whatDoing, setWhatDoing] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setWhatDoing("");
    setError(null);
    setSummary(null);

    const lectureMatch = pathname.match(/^\/lectures\/([^/]+)/);
    const lectureId = lectureMatch?.[1];

    if (lectureId && /^[a-f\d]{24}$/i.test(lectureId)) {
      void fetch(`/api/lectures/${lectureId}/summary`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Summary | null) => {
          if (d) setSummary(d);
        })
        .catch(() => undefined);
    }
  }, [open, pathname]);

  const submit = async () => {
    const desc = description.trim();
    if (!desc) {
      setError("Please describe what went wrong.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lectureMatch = pathname.match(/^\/lectures\/([^/]+)/);
      const courseMatch = pathname.match(/^\/courses\/([^/]+)/);
      const studyMatch = pathname.match(/^\/study\/([^/]+)/);
      const lectureId = lectureMatch?.[1];
      const courseId = courseMatch?.[1] ?? studyMatch?.[1];

      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          whatUserWasDoing: whatDoing.trim() || undefined,
          lectureId:
            lectureId && /^[a-f\d]{24}$/i.test(lectureId) ? lectureId : undefined,
          courseId:
            courseId && /^[a-f\d]{24}$/i.test(courseId) ? courseId : undefined,
          route: pathname || undefined,
          processingStatus: summary?.processingStatus,
          segmentCount: summary?.segmentCount,
          factCount: summary?.factCount,
          cardCount: summary?.cardCount,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit");
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-bug-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
        <h2 id="report-bug-title" className="text-lg font-semibold text-[var(--foreground)]">
          Report a bug
        </h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          We&apos;ll include this page, device info, and any lecture status we already loaded —
          you don&apos;t need technical details.
        </p>
        <label className="mt-4 block text-sm font-medium">What happened?</label>
        <textarea
          className="mt-1 w-full min-h-[100px] rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (required)"
          maxLength={8000}
        />
        <label className="mt-3 block text-sm font-medium">
          What were you trying to do? (optional)
        </label>
        <textarea
          className="mt-1 w-full min-h-[60px] rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
          value={whatDoing}
          onChange={(e) => setWhatDoing(e.target.value)}
          placeholder="e.g. upload a lecture, study cards…"
          maxLength={2000}
        />
        {error && (
          <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={loading}>
            {loading ? "Sending…" : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

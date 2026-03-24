"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

function isoToDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToIsoUtc(ymd: string): string {
  if (!ymd) return "";
  return `${ymd}T00:00:00.000Z`;
}

type Props = {
  courseId: string;
  /** ISO string from server, or null if unset */
  initialNextExamIso: string | null;
};

export function CourseExamDateForm({ courseId, initialNextExamIso }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(() => isoToDateInputValue(initialNextExamIso));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(isoToDateInputValue(initialNextExamIso));
  }, [initialNextExamIso]);

  const save = async (nextExamDate: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextExamDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save");
      }
      if (nextExamDate === null) {
        setValue("");
      } else {
        setValue(isoToDateInputValue(nextExamDate));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1 min-w-[12rem]">
          <label htmlFor="next-exam-date" className="text-sm font-medium">
            Date
          </label>
          <input
            id="next-exam-date"
            type="date"
            className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={saving || !value}
            onClick={() => save(dateInputToIsoUtc(value))}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || (!initialNextExamIso && !value)}
            onClick={() => {
              void save(null);
            }}
          >
            Clear
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-[var(--destructive)] text-sm">{error}</p>
      )}
    </div>
  );
}

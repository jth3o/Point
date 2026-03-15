"use client";

import { useState } from "react";
import { LectureSegments } from "./LectureSegments";

export function LectureDebugSection({ lectureId }: { lectureId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
      >
        <span>Debug: transcript segments</span>
        <span className="text-[var(--muted-foreground)]">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] p-3">
          <LectureSegments lectureId={lectureId} />
        </div>
      )}
    </div>
  );
}

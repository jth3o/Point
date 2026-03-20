"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CARD_DELETE_REASONS,
  CARD_DELETE_REASON_LABELS,
  type CardDeleteReason,
} from "@/lib/card-deletion-reasons";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: CardDeleteReason) => void | Promise<void>;
  loading?: boolean;
  /** Short preview (e.g. front line) */
  preview?: string;
};

export function DeleteCardReasonDialog({
  open,
  onCancel,
  onConfirm,
  loading = false,
  preview,
}: Props) {
  const [reason, setReason] = useState<CardDeleteReason | "">("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-card-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
        <h2 id="delete-card-title" className="text-lg font-semibold text-[var(--foreground)]">
          Delete this card?
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          This cannot be undone. Why are you deleting it?
        </p>
        {preview ? (
          <p className="mt-2 line-clamp-2 text-sm text-[var(--foreground)]">{preview}</p>
        ) : null}
        <div className="mt-4 space-y-2">
          {CARD_DELETE_REASONS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-[var(--accent)]"
            >
              <input
                type="radio"
                name="delete-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="h-4 w-4"
              />
              <span className="text-sm">{CARD_DELETE_REASON_LABELS[r]}</span>
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason || loading}
            onClick={() => reason && void onConfirm(reason)}
          >
            {loading ? "Deleting…" : "Delete card"}
          </Button>
        </div>
      </div>
    </div>
  );
}

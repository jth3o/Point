"use client";

import { useEffect, useState } from "react";
import { DeleteCardReasonDialog } from "@/components/DeleteCardReasonDialog";
import type { CardDeleteReason } from "@/lib/card-deletion-reasons";

type DueCard = {
  _id: string;
  lectureId: string;
  front: string;
  back: string;
  cardType: string;
  topic: string;
  state: string;
  nextDueAt: string;
};

export function StudySession({ courseId }: { courseId?: string }) {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpMode, setHelpMode] = useState<"explain" | "example" | null>(null);
  const [helpText, setHelpText] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DueCard | null>(null);

  const fetchDue = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = courseId ? `/api/review/due?courseId=${encodeURIComponent(courseId)}` : "/api/review/due";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load due cards");
      const data = await res.json();
      setCards(data);
      setIndex(0);
      setRevealed(false);
      setRating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDue();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when courseId changes
  }, [courseId]);

  const current = cards[index];

  const handleRate = async (r: "again" | "hard" | "good" | "easy") => {
    if (!current) return;
    setRating(true);
    try {
      const res = await fetch(`/api/review/${current._id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: r }),
      });
      if (!res.ok) throw new Error("Failed to record rating");
      setMenuOpen(false);
      setHelpMode(null);
      setHelpText("");
      if (index + 1 >= cards.length) {
        await fetchDue();
      } else {
        setIndex((i) => i + 1);
        setRevealed(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setRating(false);
    }
  };

  if (loading) return <p className="text-[var(--muted-foreground)]">Loading…</p>;
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-[var(--destructive)]">{error}</p>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--input)] bg-transparent px-3 text-sm font-medium hover:bg-[var(--accent)]"
          onClick={fetchDue}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!cards.length) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-8 text-center">
        <p className="text-[var(--muted-foreground)]">No cards due right now.</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">
          Come back later or add more cards from your lectures.
        </p>
      </div>
    );
  }

  const confirmStudyDelete = async (reason: CardDeleteReason) => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/cards/${pendingDelete._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setPendingDelete(null);
      await fetchDue();
    } catch {
      setError("Failed to delete card.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <DeleteCardReasonDialog
        open={pendingDelete !== null}
        onCancel={() => !deleteLoading && setPendingDelete(null)}
        onConfirm={confirmStudyDelete}
        loading={deleteLoading}
        preview={pendingDelete?.front}
      />
      <div className="relative rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 min-h-[200px] flex flex-col">
        {revealed && (
          <div className="absolute top-3 right-3">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Card actions"
            >
              <span className="text-lg leading-none">⋯</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-md">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)] disabled:opacity-50"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (!current) return;
                    setHelpMode("explain");
                    setHelpText("");
                    setHelpLoading(true);
                    try {
                      const res = await fetch(`/api/cards/${current._id}/help`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode: "explain" }),
                      });
                      if (!res.ok) throw new Error("Failed");
                      const data = await res.json();
                      setHelpText(data?.text ?? "");
                    } catch {
                      setHelpText("Could not load explanation.");
                    } finally {
                      setHelpLoading(false);
                    }
                  }}
                  disabled={helpLoading}
                >
                  Explain
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)] disabled:opacity-50"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (!current) return;
                    setHelpMode("example");
                    setHelpText("");
                    setHelpLoading(true);
                    try {
                      const res = await fetch(`/api/cards/${current._id}/help`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode: "example" }),
                      });
                      if (!res.ok) throw new Error("Failed");
                      const data = await res.json();
                      setHelpText(data?.text ?? "");
                    } catch {
                      setHelpText("Could not load example.");
                    } finally {
                      setHelpLoading(false);
                    }
                  }}
                  disabled={helpLoading}
                >
                  Example
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-[var(--destructive)] hover:bg-[var(--accent)] disabled:opacity-50"
                  onClick={() => {
                    setMenuOpen(false);
                    if (!current || deleteLoading) return;
                    setPendingDelete(current);
                  }}
                  disabled={deleteLoading}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
        <div className="text-xs text-[var(--muted-foreground)] mb-2">
          {current.topic} · {current.cardType}
        </div>
        <p className="text-lg font-medium text-[var(--foreground)] flex-1 whitespace-pre-wrap">
          {current.front}
        </p>
        {!revealed ? (
          <button
            type="button"
            className="mt-4 self-start inline-flex h-9 items-center justify-center rounded-md border border-[var(--input)] bg-transparent px-3 text-sm font-medium hover:bg-[var(--accent)]"
            onClick={() => {
              setRevealed(true);
              setHelpMode(null);
              setHelpText("");
            }}
          >
            Reveal answer
          </button>
        ) : (
          <>
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">Answer</p>
              <p className="text-[var(--foreground)] whitespace-pre-wrap">{current.back}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--destructive)] px-3 text-sm font-medium text-[var(--destructive-foreground)] hover:opacity-90 disabled:opacity-50"
                onClick={() => handleRate("again")}
                disabled={rating}
              >
                Again
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--input)] bg-transparent px-3 text-sm font-medium hover:bg-[var(--accent)] disabled:opacity-50"
                onClick={() => handleRate("hard")}
                disabled={rating}
              >
                Hard
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                onClick={() => handleRate("good")}
                disabled={rating}
              >
                Good
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--secondary)] px-3 text-sm font-medium hover:opacity-80 disabled:opacity-50"
                onClick={() => handleRate("easy")}
                disabled={rating}
              >
                Easy
              </button>
            </div>
            {(helpMode || helpLoading) && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)] mb-1">
                  {helpMode === "explain" ? "Explain" : "Example"}
                  {helpLoading && "…"}
                </p>
                {helpLoading ? (
                  <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
                ) : (
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{helpText}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

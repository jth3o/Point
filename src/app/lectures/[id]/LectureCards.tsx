"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type CardItem = {
  _id: string;
  front: string;
  back: string;
  cardType: string;
  topic: string;
  difficultyEstimate: number;
};

export function LectureCards({ lectureId }: { lectureId: string }) {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/cards`);
      if (!res.ok) throw new Error("Failed to load cards");
      const data = await res.json();
      setCards(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when lectureId changes
  }, [lectureId]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ lectureId: string }>) => {
      if (e.detail?.lectureId === lectureId) fetchCards();
    };
    window.addEventListener("lecture-processed", handler as EventListener);
    return () => window.removeEventListener("lecture-processed", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchCards when lectureId matches
  }, [lectureId]);

  if (loading) {
    return <p className="text-[var(--muted-foreground)] text-sm">Loading cards…</p>;
  }
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-[var(--destructive)] text-sm">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchCards}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">
        {cards.length} card{cards.length !== 1 ? "s" : ""}
      </p>
      {cards.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No cards yet. Run Process from the course page or above to generate cards.
        </p>
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => (
            <li
              key={c._id}
              className="rounded-lg border border-[var(--border)] p-3 text-sm"
            >
              <div className="flex gap-2 text-xs text-[var(--muted-foreground)] mb-2">
                <span>{c.topic}</span>
                <span>·</span>
                <span>{c.cardType}</span>
                <span>·</span>
                <span>difficulty {c.difficultyEstimate}</span>
              </div>
              <p className="font-medium text-[var(--foreground)]">{c.front}</p>
              <p className="mt-1 text-[var(--muted-foreground)]">{c.back}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

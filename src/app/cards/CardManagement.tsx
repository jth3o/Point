"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteCardReasonDialog } from "@/components/DeleteCardReasonDialog";
import type { CardDeleteReason } from "@/lib/card-deletion-reasons";

type CardItem = {
  _id: string;
  lectureId: string;
  front: string;
  back: string;
  cardType: string;
  topic: string;
  approved: boolean;
  suspended: boolean;
};

type LectureItem = { _id: string; title: string };

export function CardManagement() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    lectureId: "",
    topic: "",
    approved: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CardItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLectures = async () => {
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) return;
      const courses = await res.json();
      const allLectures: LectureItem[] = [];
      for (const c of courses) {
        const lres = await fetch(`/api/courses/${c._id}/lectures`);
        if (!lres.ok) continue;
        const list = await lres.json();
        for (const l of list) allLectures.push({ _id: l._id, title: l.title });
      }
      setLectures(allLectures);
    } catch {
      // ignore
    }
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.lectureId) params.set("lectureId", filters.lectureId);
      if (filters.topic) params.set("topic", filters.topic);
      if (filters.approved) params.set("approved", filters.approved);
      const res = await fetch(`/api/cards?${params}`);
      if (!res.ok) throw new Error("Failed to load cards");
      const data = await res.json();
      setCards(data);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures();
  }, []);

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when filters change
  }, [filters.lectureId, filters.topic, filters.approved]);

  const startEdit = (c: CardItem) => {
    setEditingId(c._id);
    setEditFront(c.front);
    setEditBack(c.back);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/cards/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: editFront, back: editBack }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      fetchCards();
    } catch {
      // could set error state
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const confirmDeleteCard = async (reason: CardDeleteReason) => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/cards/${deleteTarget._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteTarget(null);
      fetchCards();
    } catch {
      // could set error state
    } finally {
      setDeleteLoading(false);
    }
  };

  const approve = async (c: CardItem) => {
    try {
      const res = await fetch(`/api/cards/${c._id}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      fetchCards();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <DeleteCardReasonDialog
        open={deleteTarget !== null}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDeleteCard}
        loading={deleteLoading}
        preview={deleteTarget?.front}
      />
      <div className="rounded-lg border border-[var(--border)] p-4 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">Lecture</span>
          <select
            className="rounded-md border border-[var(--input)] bg-transparent px-3 py-2 text-sm"
            value={filters.lectureId}
            onChange={(e) => setFilters((f) => ({ ...f, lectureId: e.target.value }))}
          >
            <option value="">All</option>
            {lectures.map((l) => (
              <option key={l._id} value={l._id}>{l.title}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">Topic</span>
          <Input
            placeholder="Filter by topic"
            value={filters.topic}
            onChange={(e) => setFilters((f) => ({ ...f, topic: e.target.value }))}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">Approved</span>
          <select
            className="rounded-md border border-[var(--input)] bg-transparent px-3 py-2 text-sm"
            value={filters.approved}
            onChange={(e) => setFilters((f) => ({ ...f, approved: e.target.value }))}
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-[var(--muted-foreground)] text-sm">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">No cards match. Adjust filters or generate cards from a lecture.</p>
      ) : (
        <ul className="space-y-4">
          {cards.map((c) => (
            <li key={c._id} className="rounded-lg border border-[var(--border)] p-4">
              {editingId === c._id ? (
                <div className="space-y-3">
                  <Input
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    placeholder="Front"
                  />
                  <Input
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    placeholder="Back"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 text-xs text-[var(--muted-foreground)] mb-2">
                    <span>{c.topic}</span>
                    <span>·</span>
                    <span>{c.cardType}</span>
                    {c.approved && <span className="text-green-600">Approved</span>}
                  </div>
                  <p className="font-medium text-[var(--foreground)]">{c.front}</p>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">{c.back}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleteTarget(c)}>Delete</Button>
                    {!c.approved && (
                      <Button size="sm" variant="secondary" onClick={() => approve(c)}>Approve</Button>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/lectures/${c.lectureId}`}>View lecture</Link>
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

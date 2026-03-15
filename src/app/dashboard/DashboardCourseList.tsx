"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Course = { _id: string; title: string; createdAt: string };

export function DashboardCourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Failed to load courses");
      const data = await res.json();
      setCourses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const deleteCourse = async (courseId: string, title: string) => {
    if (!confirm(`Delete course "${title}"? This will remove the course, all its lectures, cards, and review data.`)) return;
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchCourses();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const createCourse = async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create course");
      }
      setNewTitle("");
      await fetchCourses();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <p className="text-[var(--muted-foreground)] text-sm">Loading courses…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="New course title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createCourse()}
        />
        <Button onClick={createCourse} disabled={creating || !newTitle.trim()}>
          {creating ? "Creating…" : "Create course"}
        </Button>
      </div>
      {error && (
        <p className="text-[var(--destructive)] text-sm">{error}</p>
      )}
      {courses.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No courses yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {courses.map((c) => (
            <li key={c._id}>
              <Card>
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <span className="font-medium">{c.title}</span>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/courses/${c._id}`}>Open</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                      onClick={() => deleteCourse(c._id, c.title)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

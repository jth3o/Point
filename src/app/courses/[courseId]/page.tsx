import mongoose from "mongoose";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourseById } from "@/lib/courses";
import { requireAuth } from "@/lib/auth-server";
import { CourseLectureList } from "./CourseLectureList";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireAuth();
  const userId = new mongoose.Types.ObjectId(String(session.user.id));
  const { courseId } = await params;
  const course = await getCourseById(courseId, userId);
  if (!course) notFound();

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">← Dashboard</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            Upload VTT lectures and process transcripts
          </p>
        </div>
      </header>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Upload lecture</CardTitle>
          <CardDescription>
            Only .vtt transcript files. Max 4MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseLectureList courseId={courseId} courseTitle={course.title} />
        </CardContent>
      </Card>
    </main>
  );
}

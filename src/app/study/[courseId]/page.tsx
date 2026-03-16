import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth-server";
import { StudySession } from "../StudySession";

export default async function StudyCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await requireAuth();
  const { courseId } = await params;
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Study</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/study">← Choose course</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </header>
      <StudySession courseId={courseId} />
    </main>
  );
}

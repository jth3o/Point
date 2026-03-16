import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-server";
import { getLectureById } from "@/lib/lectures";
import { LectureSummary } from "./LectureSummary";
import { LectureCards } from "./LectureCards";
import { LectureDebugSection } from "./LectureDebugSection";

export default async function LecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const lecture = await getLectureById(id);
  if (!lecture) notFound();

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{lecture.title}</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          {lecture.filename}
        </p>
      </header>

      <section className="mb-8">
        <LectureSummary
          lectureId={id}
          lectureTitle={lecture.title}
          courseId={String(lecture.courseId)}
        />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Generated cards</h2>
        <LectureCards lectureId={id} />
      </section>

      <section className="mt-8">
        <LectureDebugSection lectureId={id} />
      </section>
    </main>
  );
}

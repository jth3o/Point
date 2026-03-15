import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StudyCoursePicker } from "./StudyCoursePicker";

export default function StudyPage() {
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Study</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </header>
      <StudyCoursePicker />
    </main>
  );
}

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardCourseList } from "./DashboardCourseList";

export default function DashboardPage() {
  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            Courses and lectures
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/study">Study</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/cards">Cards</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </header>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Courses</CardTitle>
          <CardDescription>Create a course, then upload VTT transcripts as lectures.</CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardCourseList />
        </CardContent>
      </Card>
    </main>
  );
}

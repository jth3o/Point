import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CardManagement } from "./CardManagement";

export default function CardsPage() {
  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Cards</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/study">Study</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </header>
      <CardManagement />
    </main>
  );
}

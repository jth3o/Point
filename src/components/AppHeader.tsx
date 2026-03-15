"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user) return null;

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <nav className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm font-medium hover:underline">
            Dashboard
          </Link>
          <Link href="/study" className="text-sm font-medium hover:underline">
            Study
          </Link>
          <Link href="/cards" className="text-sm font-medium hover:underline">
            Cards
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)] truncate max-w-[180px]">
            {session.user.email}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

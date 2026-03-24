"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReportBugDialog } from "@/components/ReportBugDialog";

export function AppHeader() {
  const { data: session, status } = useSession();
  const [bugOpen, setBugOpen] = useState(false);
  const [canViewReports, setCanViewReports] = useState(false);

  useEffect(() => {
    void fetch("/api/internal/bug-reports/access")
      .then((r) => r.json())
      .then((d: { canView?: boolean }) => setCanViewReports(d.canView === true))
      .catch(() => setCanViewReports(false));
  }, []);

  if (status !== "authenticated" || !session?.user) return null;

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 flex-wrap">
          <nav className="flex items-center gap-3 flex-wrap">
            <Link href="/dashboard" className="text-sm font-medium hover:underline">
              Dashboard
            </Link>
            <Link href="/study" className="text-sm font-medium hover:underline">
              Study
            </Link>
            <Link href="/cards" className="text-sm font-medium hover:underline">
              Cards
            </Link>
            <button
              type="button"
              className="text-sm text-[var(--muted-foreground)] hover:underline"
              onClick={() => setBugOpen(true)}
            >
              Report a bug
            </button>
            {canViewReports ? (
              <Link
                href="/internal/bug-reports"
                className="text-sm text-[var(--muted-foreground)] hover:underline"
              >
                Bug reports
              </Link>
            ) : null}
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
      <ReportBugDialog open={bugOpen} onClose={() => setBugOpen(false)} />
    </>
  );
}

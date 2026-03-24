import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { BugReport } from "@/models";
import { isBugReportsAdminEmail } from "@/lib/bug-reports-admin";
import type { BugReportSource, BugReportStatus } from "@/models/BugReport";

const LIMIT = 200;

export default async function InternalBugReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isBugReportsAdminEmail(session.user.email)) notFound();

  const sp = await searchParams;
  const filter: Record<string, unknown> = {};
  const src = sp.source;
  const st = sp.status;
  if (src === "user_report" || src === "system_error") {
    filter.source = src as BugReportSource;
  }
  if (
    st === "new" ||
    st === "reviewed" ||
    st === "resolved" ||
    st === "ignored"
  ) {
    filter.status = st as BugReportStatus;
  }

  await connectDB();
  const reports = await BugReport.find(filter)
    .sort({ createdAt: -1 })
    .limit(LIMIT)
    .lean();

  const base = "/internal/bug-reports";

  const qs = (parts: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (parts.source) p.set("source", parts.source);
    if (parts.status) p.set("status", parts.status);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Bug reports</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Newest first (max {LIMIT}). Restricted to BUG_REPORTS_ADMIN_EMAILS.
      </p>

      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <span className="text-[var(--muted-foreground)]">Source:</span>
        <FilterLink href={qs({ status: st })} label="All" active={!src} />
        <FilterLink
          href={qs({ source: "user_report", status: st })}
          label="User"
          active={src === "user_report"}
        />
        <FilterLink
          href={qs({ source: "system_error", status: st })}
          label="System"
          active={src === "system_error"}
        />
        <span className="text-[var(--muted-foreground)] ml-4">Status:</span>
        <FilterLink href={qs({ source: src })} label="All" active={!st} />
        {(["new", "reviewed", "resolved", "ignored"] as const).map((s) => (
          <FilterLink
            key={s}
            href={qs({ source: src, status: s })}
            label={s}
            active={st === s}
          />
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--card)] text-left">
              <th className="p-2 font-medium">When</th>
              <th className="p-2 font-medium">Source</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">Route</th>
              <th className="p-2 font-medium">Lecture / course</th>
              <th className="p-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-[var(--muted-foreground)]">
                  No reports match.
                </td>
              </tr>
            ) : (
              reports.map((r) => {
                const id = String(r._id);
                const lec = r.lectureId ? String(r.lectureId) : null;
                const crs = r.courseId ? String(r.courseId) : null;
                const created = r.createdAt
                  ? new Date(r.createdAt).toISOString()
                  : "—";
                const desc = (r.description ?? "").slice(0, 200);
                const more = (r.description ?? "").length > 200 ? "…" : "";
                return (
                  <tr key={id} className="border-b border-[var(--border)] align-top">
                    <td className="p-2 whitespace-nowrap text-xs text-[var(--muted-foreground)]">
                      {created}
                    </td>
                    <td className="p-2">{r.source}</td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2 max-w-[140px] truncate" title={r.route ?? ""}>
                      {r.route ?? "—"}
                    </td>
                    <td className="p-2 text-xs">
                      {lec ? (
                        <Link className="underline" href={`/lectures/${lec}`}>
                          Lecture
                        </Link>
                      ) : (
                        "—"
                      )}
                      {crs ? (
                        <>
                          {" · "}
                          <Link className="underline" href={`/courses/${crs}`}>
                            Course
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <span title={r.description}>{desc + more}</span>
                      {r.errorMessage ? (
                        <p className="mt-1 text-xs text-[var(--destructive)]">
                          {String(r.errorMessage).slice(0, 300)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "font-medium underline"
          : "text-[var(--muted-foreground)] hover:underline"
      }
    >
      {label}
    </Link>
  );
}

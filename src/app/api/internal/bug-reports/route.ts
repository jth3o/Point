import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { isBugReportsAdminEmail } from "@/lib/bug-reports-admin";
import { BugReport } from "@/models";
import type { BugReportSource, BugReportStatus } from "@/models/BugReport";

const LIMIT = 200;

export async function GET(request: NextRequest) {
  const session = await auth();
  const email =
    session?.user && "email" in session.user
      ? (session.user.email as string | undefined)
      : undefined;
  if (!session?.user || !isBugReportsAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source") as BugReportSource | null;
  const status = searchParams.get("status") as BugReportStatus | null;

  const filter: Record<string, unknown> = {};
  if (source === "user_report" || source === "system_error") {
    filter.source = source;
  }
  if (
    status === "new" ||
    status === "reviewed" ||
    status === "resolved" ||
    status === "ignored"
  ) {
    filter.status = status;
  }

  await connectDB();
  const reports = await BugReport.find(filter)
    .sort({ createdAt: -1 })
    .limit(LIMIT)
    .lean();

  return NextResponse.json({
    reports: reports.map((r) => ({
      ...r,
      _id: (r._id as mongoose.Types.ObjectId).toString(),
      userId: r.userId ? String(r.userId) : null,
      lectureId: r.lectureId ? String(r.lectureId) : null,
      courseId: r.courseId ? String(r.courseId) : null,
    })),
  });
}

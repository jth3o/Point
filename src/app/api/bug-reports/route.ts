import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { BugReport, Course } from "@/models";

const MAX_DESC = 8000;
const MAX_CONTEXT = 2000;

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await auth();
    const userEmail =
      session?.user && "email" in session.user
        ? (session.user.email as string | undefined)
        : undefined;

    const body = (await request.json().catch(() => ({}))) as {
      description?: string;
      whatUserWasDoing?: string;
      lectureId?: string;
      courseId?: string;
      route?: string;
      processingStatus?: string;
      segmentCount?: number;
      factCount?: number;
      cardCount?: number;
      userAgent?: string;
    };

    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    if (!description || description.length > MAX_DESC) {
      return NextResponse.json(
        { error: "description is required (max 8000 characters)" },
        { status: 400 }
      );
    }

    const whatUserWasDoing =
      typeof body.whatUserWasDoing === "string"
        ? body.whatUserWasDoing.trim().slice(0, MAX_CONTEXT)
        : undefined;

    let lectureId: mongoose.Types.ObjectId | undefined;
    if (body.lectureId) {
      if (!mongoose.Types.ObjectId.isValid(body.lectureId)) {
        return NextResponse.json({ error: "Invalid lectureId" }, { status: 400 });
      }
      const owned = await isLectureOwnedByUser(body.lectureId, userId);
      if (!owned) {
        return NextResponse.json({ error: "Invalid lectureId" }, { status: 400 });
      }
      lectureId = new mongoose.Types.ObjectId(body.lectureId);
    }

    let courseId: mongoose.Types.ObjectId | undefined;
    if (body.courseId) {
      if (!mongoose.Types.ObjectId.isValid(body.courseId)) {
        return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
      }
      await connectDB();
      const course = await Course.findOne({
        _id: body.courseId,
        userId,
      })
        .select("_id")
        .lean();
      if (!course) {
        return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
      }
      courseId = new mongoose.Types.ObjectId(body.courseId);
    }

    const route =
      typeof body.route === "string"
        ? body.route.trim().slice(0, 500)
        : undefined;

    await connectDB();
    await BugReport.create({
      userId,
      userEmail: userEmail ?? undefined,
      lectureId,
      courseId,
      route,
      description,
      whatUserWasDoing,
      processingStatus:
        typeof body.processingStatus === "string"
          ? body.processingStatus.slice(0, 120)
          : undefined,
      segmentCount:
        typeof body.segmentCount === "number" && Number.isFinite(body.segmentCount)
          ? body.segmentCount
          : undefined,
      factCount:
        typeof body.factCount === "number" && Number.isFinite(body.factCount)
          ? body.factCount
          : undefined,
      cardCount:
        typeof body.cardCount === "number" && Number.isFinite(body.cardCount)
          ? body.cardCount
          : undefined,
      userAgent:
        typeof body.userAgent === "string"
          ? body.userAgent.slice(0, 500)
          : undefined,
      environment:
        process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      source: "user_report",
      status: "new",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/bug-reports", e);
    return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
  }
}

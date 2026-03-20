import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { Course, type CourseCardCoverageMode } from "@/models";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const courses = await Course.find({ userId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json(courses);
  } catch (e) {
    console.error("GET /api/courses", e);
    return NextResponse.json(
      { error: "Failed to list courses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "title is required and must be a non-empty string" },
        { status: 400 }
      );
    }
    let cardCoverageMode: CourseCardCoverageMode | undefined;
    if (body?.cardCoverageMode !== undefined && body?.cardCoverageMode !== null) {
      if (
        body.cardCoverageMode !== "high" &&
        body.cardCoverageMode !== "balanced" &&
        body.cardCoverageMode !== "compressed"
      ) {
        return NextResponse.json(
          {
            error:
              "cardCoverageMode must be one of: high, balanced, compressed",
          },
          { status: 400 }
        );
      }
      cardCoverageMode = body.cardCoverageMode;
    }
    await connectDB();
    const course = await Course.create({
      userId,
      title,
      cardCoverageMode: cardCoverageMode ?? "balanced",
    });
    return NextResponse.json(course);
  } catch (e) {
    console.error("POST /api/courses", e);
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}

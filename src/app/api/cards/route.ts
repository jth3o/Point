import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { getLectureIdsForUser } from "@/lib/ownership";
import { Card } from "@/models";

/**
 * GET /api/cards?lectureId=...&topic=...&approved=...&suspended=...
 * List cards with optional filters for management. Scoped to current user's lectures.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const lectureIds = await getLectureIdsForUser(userId);
    if (lectureIds.length === 0) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const lectureId = searchParams.get("lectureId");
    const topic = searchParams.get("topic");
    const approved = searchParams.get("approved");
    const suspended = searchParams.get("suspended");

    await connectDB();

    const filter: Record<string, unknown> = { lectureId: { $in: lectureIds } };
    if (lectureId && mongoose.Types.ObjectId.isValid(lectureId) && lectureIds.some((lid) => String(lid) === lectureId)) {
      filter.lectureId = lectureId;
    }
    if (topic && topic.trim()) {
      filter.topic = new RegExp(topic.trim(), "i");
    }
    if (approved !== null && approved !== undefined && approved !== "") {
      filter.approved = approved === "true";
    }
    if (suspended !== null && suspended !== undefined && suspended !== "") {
      filter.suspended = suspended === "true";
    }

    const cards = await Card.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return NextResponse.json(cards);
  } catch (e) {
    console.error("GET /api/cards", e);
    return NextResponse.json(
      { error: "Failed to list cards" },
      { status: 500 }
    );
  }
}

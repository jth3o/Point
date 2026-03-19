import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isCardOwnedByUser } from "@/lib/ownership";
import { Card, ReviewState } from "@/models";
import { getRatingPreviews } from "@/lib/srs";
import type { ReviewStateType } from "@/models/ReviewState";

type RouteContext = { params: Promise<{ cardId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { cardId } = await context.params;
    if (!cardId || !mongoose.Types.ObjectId.isValid(cardId)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    await connectDB();
    const card = await Card.findById(cardId).select("lectureId suspended");
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    const owned = await isCardOwnedByUser(String(card.lectureId), userId);
    if (!owned) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (card.suspended) {
      return NextResponse.json({ error: "Card suspended" }, { status: 400 });
    }

    const rs = await ReviewState.findOne({ userId, cardId });
    const now = new Date();

    const state = (rs?.state ?? "new") as ReviewStateType;
    const previews = getRatingPreviews(now, {
      state,
      learningStep: rs?.learningStep ?? 0,
      reps: rs?.reps ?? 0,
      lapseCount: rs?.lapseCount ?? 0,
      intervalDays: rs?.intervalDays ?? 0,
      easeFactor: rs?.easeFactor ?? 2.5,
    });

    return NextResponse.json({
      state,
      previews: {
        again: previews.again,
        hard: previews.hard,
        good: previews.good,
        easy: previews.easy,
      },
    });
  } catch (e) {
    console.error("GET /api/review/[cardId]/preview", e);
    return NextResponse.json(
      { error: "Failed to preview intervals" },
      { status: 500 }
    );
  }
}

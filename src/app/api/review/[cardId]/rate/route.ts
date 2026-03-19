import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isCardOwnedByUser } from "@/lib/ownership";
import { Card, ReviewState, ReviewLog } from "@/models";
import { computeNextReview, getInitialNextDueAt } from "@/lib/srs";
import type { Rating } from "@/models/ReviewLog";

type RouteContext = { params: Promise<{ cardId: string }> };

const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { cardId } = await context.params;
    if (!cardId || !mongoose.Types.ObjectId.isValid(cardId)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const ratingRaw = body?.rating ?? body?.Rating;
    const rating = typeof ratingRaw === "string" && RATINGS.includes(ratingRaw.toLowerCase() as Rating)
      ? (ratingRaw.toLowerCase() as Rating)
      : null;
    if (!rating) {
      return NextResponse.json(
        { error: "rating required: one of Again, Hard, Good, Easy" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Cannot review suspended card" },
        { status: 400 }
      );
    }

    let rs = await ReviewState.findOne({ userId, cardId });
    const now = new Date();
    const previousState = rs?.state ?? "new";
    const previousIntervalDays = rs?.intervalDays ?? 0;

    if (!rs) {
      rs = await ReviewState.create({
        userId,
        cardId,
        state: "new",
        learningStep: 0,
        reps: 0,
        lapseCount: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        nextDueAt: getInitialNextDueAt(),
      });
    }

    const next = computeNextReview(now, {
      state: rs.state as "new" | "learning" | "review" | "relearning",
      learningStep: rs.learningStep ?? 0,
      reps: rs.reps,
      lapseCount: rs.lapseCount,
      intervalDays: rs.intervalDays,
      easeFactor: rs.easeFactor,
      rating,
    });

    rs.state = next.state;
    rs.learningStep = next.learningStep;
    rs.reps = next.reps;
    rs.lapseCount = next.lapseCount;
    rs.intervalDays = next.intervalDays;
    rs.easeFactor = next.easeFactor;
    rs.lastReviewedAt = now;
    rs.nextDueAt = next.nextDueAt;
    rs.updatedAt = now;
    await rs.save();

    await ReviewLog.create({
      userId,
      cardId,
      rating,
      reviewedAt: now,
      previousState,
      newState: next.state,
      previousIntervalDays,
      newIntervalDays: next.intervalDays,
    });

    return NextResponse.json({
      success: true,
      state: next.state,
      nextDueAt: next.nextDueAt.toISOString(),
      intervalDays: next.intervalDays,
    });
  } catch (e) {
    console.error("POST /api/review/[cardId]/rate", e);
    return NextResponse.json(
      { error: "Failed to record rating" },
      { status: 500 }
    );
  }
}

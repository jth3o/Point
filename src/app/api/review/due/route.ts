import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { getLectureIdsForUser } from "@/lib/ownership";
import { Card, ReviewState, ReviewLog, Lecture } from "@/models";
import { getInitialNextDueAt } from "@/lib/srs";
import type { ReviewStateType } from "@/models/ReviewState";

const MAX_QUEUE = 50;
const NEW_CARDS_PER_DAY = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId") ?? undefined;

    await connectDB();
    const userLectureIds = await getLectureIdsForUser(userId);
    if (userLectureIds.length === 0) {
      return NextResponse.json([]);
    }

    const now = new Date();
    let cards = await Card.find({
      suspended: false,
      lectureId: { $in: userLectureIds },
    }).lean();
    if (courseId) {
      const lectures = await Lecture.find({ courseId }).select("_id").lean();
      const lectureIds = new Set(lectures.map((l) => String(l._id)));
      cards = cards.filter((c) => lectureIds.has(String(c.lectureId)));
    }

    const stateMap = await ReviewState.find({ userId }).lean().then((list) => {
      const m: Record<string, (typeof list)[0]> = {};
      for (const rs of list) m[String(rs.cardId)] = rs;
      return m;
    });

    const lectureToCourse = await Lecture.find({})
      .select("_id courseId")
      .lean()
      .then((list) => {
        const m: Record<string, string> = {};
        for (const l of list) m[String(l._id)] = String(l.courseId);
        return m;
      });

    // Cap "new" introductions per day only within this queue scope (e.g. this course).
    // A global count wrongly hid all new cards in other courses after 20 reviews elsewhere.
    const scopeCardIds = cards.map((c) => c._id);
    const newIntroducedToday =
      scopeCardIds.length === 0
        ? []
        : await ReviewLog.distinct("cardId", {
            userId,
            reviewedAt: { $gte: startOfUtcDay(now) },
            previousState: "new",
            cardId: { $in: scopeCardIds },
          });
    const newSlotsLeft = Math.max(0, NEW_CARDS_PER_DAY - newIntroducedToday.length);

    type Row = {
      _id: string;
      lectureId: string;
      courseId: string;
      front: string;
      back: string;
      cardType: string;
      topic: string;
      state: string;
      nextDueAt: string;
    };

    const relearning: Row[] = [];
    const learning: Row[] = [];
    const reviewDue: Row[] = [];
    const newCards: Row[] = [];

    for (const card of cards) {
      const rs = stateMap[String(card._id)];
      const nextDue = rs ? new Date(rs.nextDueAt) : getInitialNextDueAt();
      if (nextDue > now) continue;

      const state = (rs?.state ?? "new") as ReviewStateType;
      const row: Row = {
        _id: String(card._id),
        lectureId: String(card.lectureId),
        courseId: lectureToCourse[String(card.lectureId)] ?? "",
        front: card.front,
        back: card.back,
        cardType: card.cardType,
        topic: card.topic,
        state,
        nextDueAt: nextDue.toISOString(),
      };

      if (state === "relearning") relearning.push(row);
      else if (state === "learning") learning.push(row);
      else if (state === "review") reviewDue.push(row);
      else newCards.push(row);
    }

    const queue = [
      ...shuffle(relearning),
      ...shuffle(learning),
      ...shuffle(reviewDue),
      ...shuffle(newCards).slice(0, newSlotsLeft),
    ].slice(0, MAX_QUEUE);

    return NextResponse.json(queue);
  } catch (e) {
    console.error("GET /api/review/due", e);
    return NextResponse.json(
      { error: "Failed to fetch due cards" },
      { status: 500 }
    );
  }
}

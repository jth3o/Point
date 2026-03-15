import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { getLectureIdsForUser } from "@/lib/ownership";
import { Card, ReviewState, Lecture } from "@/models";
import { getInitialNextDueAt } from "@/lib/srs";

const MAX_DUE = 50;

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

    const due: Array<{
      _id: string;
      lectureId: string;
      courseId: string;
      front: string;
      back: string;
      cardType: string;
      topic: string;
      state: string;
      nextDueAt: string;
    }> = [];

    for (const card of cards) {
      const rs = stateMap[String(card._id)];
      const nextDue = rs ? new Date(rs.nextDueAt) : getInitialNextDueAt();
      if (nextDue <= now) {
        due.push({
          _id: String(card._id),
          lectureId: String(card.lectureId),
          courseId: lectureToCourse[String(card.lectureId)] ?? "",
          front: card.front,
          back: card.back,
          cardType: card.cardType,
          topic: card.topic,
          state: rs?.state ?? "new",
          nextDueAt: nextDue.toISOString(),
        });
      }
    }

    due.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
    const limited = due.slice(0, MAX_DUE);

    return NextResponse.json(limited);
  } catch (e) {
    console.error("GET /api/review/due", e);
    return NextResponse.json(
      { error: "Failed to fetch due cards" },
      { status: 500 }
    );
  }
}

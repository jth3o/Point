import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { getLectureIdsForUser } from "@/lib/ownership";
import { Card, ReviewState, ReviewLog, Lecture, Course, type ICourse } from "@/models";
import { getInitialNextDueAt } from "@/lib/srs";
import type { ReviewStateType } from "@/models/ReviewState";
import { isCourseInExamWeek } from "@/lib/exam-pacing";
import {
  computeScaledNewTake,
  computeSessionCap,
  buildPriorityStudyQueue,
  shuffleArray,
} from "@/lib/study-queue";

/** Max new cards introduced per UTC day (per queue scope / course filter). */
const NEW_CARDS_PER_DAY = 20;

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

    const scopeCardIds = cards.map((c) => c._id);

    const cardIdToCourse = new Map<string, string>();
    for (const c of cards) {
      const cid = lectureToCourse[String(c.lectureId)];
      if (cid) cardIdToCourse.set(String(c._id), cid);
    }

    /** Courses in exam week (≤7 days): daily new limits do not apply to their cards. */
    const examCourseIds = new Set<string>();
    let examModeScoped = false;

    if (!courseId) {
      const rawIds = [
        ...new Set(
          cards
            .map((c) => lectureToCourse[String(c.lectureId)])
            .filter((x): x is string => Boolean(x))
        ),
      ];
      if (rawIds.length > 0) {
        const oids = rawIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));
        const cs = (await Course.find({
          _id: { $in: oids },
          userId,
        })
          .select("_id nextExamDate")
          .lean()) as Pick<ICourse, "_id" | "nextExamDate">[];
        for (const c of cs) {
          if (c.nextExamDate && isCourseInExamWeek(c.nextExamDate, now)) {
            examCourseIds.add(String(c._id));
          }
        }
      }
    } else if (mongoose.Types.ObjectId.isValid(courseId)) {
      const course = (await Course.findOne({ _id: courseId, userId })
        .select("nextExamDate")
        .lean()) as Pick<ICourse, "nextExamDate"> | null;
      if (course?.nextExamDate && isCourseInExamWeek(course.nextExamDate, now)) {
        examModeScoped = true;
        examCourseIds.add(courseId);
      }
    }

    const newIntroducedTodayAll =
      scopeCardIds.length === 0
        ? []
        : await ReviewLog.distinct("cardId", {
            userId,
            reviewedAt: { $gte: startOfUtcDay(now) },
            previousState: "new",
            cardId: { $in: scopeCardIds },
          });

    const countTowardDailyPace = newIntroducedTodayAll.filter((id) => {
      const cid = cardIdToCourse.get(String(id));
      if (!cid) return true;
      return !examCourseIds.has(cid);
    }).length;

    const newSlotsLeft = Math.max(0, NEW_CARDS_PER_DAY - countTowardDailyPace);

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

    const R = relearning.length;
    const L = learning.length;
    const Rev = reviewDue.length;
    const N = newCards.length;

    let newTake: number;
    let sessionCap: number;
    let newCardsForQueue = newCards;
    let shuffleNew: boolean | undefined;

    if (examModeScoped) {
      newTake = N;
      sessionCap = R + L + Rev + newTake;
    } else if (!courseId && examCourseIds.size > 0) {
      const newExam = newCards.filter((r) => examCourseIds.has(r.courseId));
      const newNormal = newCards.filter((r) => !examCourseIds.has(r.courseId));
      const N_exam = newExam.length;
      const N_normal = newNormal.length;
      const newTake_exam = N_exam;
      const newTake_normal = computeScaledNewTake(N_normal, newSlotsLeft);
      newTake = newTake_exam + newTake_normal;

      const examInQueue =
        relearning.some((r) => examCourseIds.has(r.courseId)) ||
        learning.some((r) => examCourseIds.has(r.courseId)) ||
        reviewDue.some((r) => examCourseIds.has(r.courseId)) ||
        N_exam > 0;

      sessionCap = examInQueue
        ? R + L + Rev + newTake
        : computeSessionCap(R, L, Rev, newTake);

      newCardsForQueue = [
        ...shuffleArray(newExam).slice(0, newTake_exam),
        ...shuffleArray(newNormal).slice(0, newTake_normal),
      ];
      shuffleNew = false;
    } else {
      newTake = computeScaledNewTake(N, newSlotsLeft);
      sessionCap = computeSessionCap(R, L, Rev, newTake);
    }

    const queue = buildPriorityStudyQueue(
      relearning,
      learning,
      reviewDue,
      newCardsForQueue,
      sessionCap,
      newTake,
      shuffleNew === false ? { shuffleNew: false } : undefined
    );

    return NextResponse.json(queue);
  } catch (e) {
    console.error("GET /api/review/due", e);
    return NextResponse.json(
      { error: "Failed to fetch due cards" },
      { status: 500 }
    );
  }
}

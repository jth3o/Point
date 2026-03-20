import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isCardOwnedByUser } from "@/lib/ownership";
import {
  Card,
  ReviewState,
  ReviewLog,
  Lecture,
  CardDeletionLog,
  type ICard,
  type ILecture,
} from "@/models";
import { parseCardDeleteReason } from "@/lib/card-deletion-reasons";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/cards/[id]
 * Update front, back, topic, cardType, difficultyEstimate.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await context.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    await connectDB();
    const card = await Card.findById(id).select("lectureId").lean() as { lectureId?: unknown } | null;
    if (!card || !card.lectureId || !(await isCardOwnedByUser(String(card.lectureId), userId))) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof body.front === "string") updates.front = body.front.trim();
    if (typeof body.back === "string") updates.back = body.back.trim();
    if (typeof body.topic === "string") updates.topic = body.topic.trim();
    if (typeof body.cardType === "string") updates.cardType = body.cardType.trim();
    if (typeof body.difficultyEstimate === "number") updates.difficultyEstimate = body.difficultyEstimate;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await Card.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/cards/[id]", e);
    return NextResponse.json(
      { error: "Failed to update card" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cards/[id]
 * Body: `{ "reason": "not_relevant" | "incorrect_information" | "bad_wording" }` (required).
 * Logs deletion, then removes ReviewState, ReviewLog, and Card.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await context.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = parseCardDeleteReason(body?.reason);
    if (!reason) {
      return NextResponse.json(
        {
          error:
            "Delete reason is required. Send JSON body: { \"reason\": \"not_relevant\" | \"incorrect_information\" | \"bad_wording\" }",
        },
        { status: 400 }
      );
    }

    await connectDB();
    const card = (await Card.findById(id).lean()) as ICard | null;
    if (
      !card ||
      !card.lectureId ||
      !(await isCardOwnedByUser(String(card.lectureId), userId))
    ) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const lecture = (await Lecture.findById(card.lectureId)
      .select("courseId")
      .lean()) as Pick<ILecture, "courseId"> | null;
    if (!lecture?.courseId) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    await CardDeletionLog.create({
      userId,
      cardId: card._id,
      lectureId: card.lectureId,
      courseId: lecture.courseId,
      deleteReason: reason,
      deletedAt: new Date(),
      snapshotFront: card.front,
      snapshotBack: card.back,
      snapshotCardType: card.cardType,
      snapshotTopic: card.topic,
      snapshotDifficultyEstimate: card.difficultyEstimate,
    });

    await ReviewState.deleteMany({ cardId: id });
    await ReviewLog.deleteMany({ cardId: id });
    await Card.deleteOne({ _id: id });

    return NextResponse.json({ success: true, deleted: true });
  } catch (e) {
    console.error("DELETE /api/cards/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete card" },
      { status: 500 }
    );
  }
}

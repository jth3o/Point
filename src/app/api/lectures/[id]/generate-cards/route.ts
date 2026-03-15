import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import { Lecture, Fact, Card } from "@/models";
import { generateCardsFromFacts } from "@/lib/services/card-generation";
import { isContextDependentCard } from "@/lib/card-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await context.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 });
    }
    const owned = await isLectureOwnedByUser(id, userId);
    if (!owned) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    await connectDB();

    const lecture = await Lecture.findById(id);
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const facts = await Fact.find({ lectureId: id }).sort({ createdAt: 1 }).lean();
    if (!facts.length) {
      return NextResponse.json(
        { error: "No facts found. Extract facts first." },
        { status: 400 }
      );
    }

    await Lecture.findByIdAndUpdate(id, {
      processingStatus: "generating_cards",
    });

    const generated = await generateCardsFromFacts(
      facts.map((f) => ({
        factText: f.factText,
        factType: f.factType,
        tags: f.tags ?? [],
      }))
    );

    const factIds = facts.map((f) => f._id);

    await Card.deleteMany({ lectureId: id });

    const created = [];
    for (const card of generated) {
      const sourceFactIds = [...new Set(card.source_fact_indices)]
        .filter((i) => i >= 0 && i < factIds.length)
        .map((i) => factIds[i]!);
      if (sourceFactIds.length === 0) continue;
      if (isContextDependentCard(card.front, card.back)) continue;

      const doc = await Card.create({
        lectureId: id,
        factIds: sourceFactIds,
        front: card.front,
        back: card.back,
        cardType: card.card_type,
        topic: card.topic,
        difficultyEstimate: card.difficulty_estimate,
        approved: false,
        suspended: false,
      });
      created.push(doc);
    }

    await Lecture.findByIdAndUpdate(id, {
      processingStatus: "ready",
    });

    return NextResponse.json({
      success: true,
      lectureId: id,
      cardsCreated: created.length,
    });
  } catch (error: unknown) {
    console.error("Generate cards route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate cards",
        details: error instanceof Error ? error.message : null,
      },
      { status: 500 }
    );
  }
}

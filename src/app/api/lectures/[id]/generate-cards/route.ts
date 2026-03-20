import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import {
  Lecture,
  Fact,
  Card,
  Course,
  type ICourse,
  type ILecture,
} from "@/models";
import { generateCardsFromFacts } from "@/lib/services/card-generation";
import { isContextDependentCard } from "@/lib/card-validation";
import {
  computeLectureCardBudget,
  parseCardCoverageMode,
  type CardCoverageMode,
} from "@/lib/course-card-coverage";
import {
  deduplicateGeneratedCards,
  remapCardSourceIndices,
  selectFactsForCardGeneration,
} from "@/lib/card-generation-selection";
import { logPipeline } from "@/lib/pipeline-log";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const started = Date.now();
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

    const lecture = (await Lecture.findById(id).lean()) as ILecture | null;
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const course = (await Course.findOne({
      _id: lecture.courseId,
      userId,
    })
      .select("cardCoverageMode")
      .lean()) as Pick<ICourse, "cardCoverageMode"> | null;
    const coverageMode: CardCoverageMode = parseCardCoverageMode(
      course?.cardCoverageMode,
      "balanced"
    );

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

    const budget = computeLectureCardBudget(coverageMode, facts.length);

    const forSelection = facts.map((f, originalIndex) => ({
      originalIndex,
      factText: f.factText,
      factType: f.factType,
      tags: f.tags ?? [],
      importance: f.importance,
      confidence: f.confidence,
    }));

    const { selected, originalIndexMap, clusters, droppedFactCount } =
      selectFactsForCardGeneration(
        forSelection,
        coverageMode,
        budget.maxCards
      );

    const compactSummary = `cov=${coverageMode} facts=${selected.length}/${facts.length} cl=${clusters.length} flt=${droppedFactCount} tgt=${budget.target} max=${budget.maxCards}`;
    logPipeline("generate_cards_start", id, {
      factTotal: facts.length,
      factsInPrompt: selected.length,
      clusters: clusters.length,
      coverageMode,
      targetCards: budget.target,
      maxCards: budget.maxCards,
    });

    const generated = await generateCardsFromFacts(
      selected.map((f) => ({
        factText: f.factText,
        factType: f.factType,
        tags: f.tags ?? [],
      })),
      {
        coverageMode,
        targetCardCount: budget.target,
        minCardCount: budget.minCards,
        maxCardCount: budget.maxCards,
        selectionSummary: compactSummary,
      }
    );

    const factIds = facts.map((f) => f._id);

    await Card.deleteMany({ lectureId: id });

    const remapped = generated.map((card) => ({
      ...card,
      source_fact_indices: remapCardSourceIndices(
        card.source_fact_indices,
        originalIndexMap
      ),
    }));

    const deduped = deduplicateGeneratedCards(remapped);
    const capped = deduped.slice(0, budget.maxCards);

    const created = [];
    for (const card of capped) {
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

    const elapsedMs = Date.now() - started;
    logPipeline("generate_cards_done", id, {
      factTotal: facts.length,
      factsInPrompt: selected.length,
      modelCards: generated.length,
      afterDedupe: deduped.length,
      cardsSaved: created.length,
      elapsedMs,
    });

    return NextResponse.json({
      success: true,
      lectureId: id,
      cardsCreated: created.length,
      cardCoverageMode: coverageMode,
      cardBudget: {
        target: budget.target,
        min: budget.minCards,
        max: budget.maxCards,
        scale: budget.scale,
      },
      factsInPrompt: selected.length,
      factClusterCount: clusters.length,
      elapsedMs,
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

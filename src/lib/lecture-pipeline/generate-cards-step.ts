import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Lecture, Fact, Card, Course, type ICourse, type ILecture } from "@/models";
import { generateCardsFromFacts } from "@/lib/services/card-generation";
import { isContextDependentCard } from "@/lib/card-validation";
import {
  computeLectureCardBudget,
  computeMiniDeckBudget,
  parseCardCoverageMode,
  type CardCoverageMode,
} from "@/lib/course-card-coverage";
import {
  deduplicateGeneratedCards,
  deduplicateGeneratedCardsAgainstExisting,
  remapCardSourceIndices,
  selectFactsForCardGeneration,
} from "@/lib/card-generation-selection";
import { logPipeline } from "@/lib/pipeline-log";
import {
  setLectureStatusWithProgress,
  touchLectureProgress,
} from "./lecture-progress";
import { recordPipelineSystemError } from "@/lib/record-pipeline-bug";

export type DeckPhase = "initial" | "remaining" | "full";

export type GenerateCardsStepResult =
  | {
      ok: true;
      phase: DeckPhase;
      cardsCreated: number;
      skipped?: boolean;
      reason?: string;
      coverageMode?: CardCoverageMode;
      cardBudget?: {
        target: number;
        min: number;
        max: number;
        scale: number;
      };
      factsInPrompt?: number;
      factClusterCount?: number;
      miniDeckBudget?: { minCards: number; maxCards: number; target: number };
      fullBudget?: {
        target: number;
        min: number;
        max: number;
        scale: number;
      };
    }
  | { ok: false; error: string };

async function saveCardDocs(
  lectureId: string,
  capped: Array<{
    front: string;
    back: string;
    card_type: string;
    topic: string;
    difficulty_estimate: number;
    source_fact_indices: number[];
  }>,
  factIds: mongoose.Types.ObjectId[],
  generationPhase: "initial" | "expansion"
): Promise<number> {
  let n = 0;
  for (const card of capped) {
    const sourceFactIds = [...new Set(card.source_fact_indices)]
      .filter((i) => i >= 0 && i < factIds.length)
      .map((i) => factIds[i]!);
    if (sourceFactIds.length === 0) continue;
    if (isContextDependentCard(card.front, card.back)) continue;

    await Card.create({
      lectureId,
      factIds: sourceFactIds,
      front: card.front,
      back: card.back,
      cardType: card.card_type,
      topic: card.topic,
      difficultyEstimate: card.difficulty_estimate,
      approved: false,
      suspended: false,
      generationPhase,
    });
    n++;
  }
  return n;
}

/**
 * Same behavior as POST /api/lectures/[id]/generate-cards (no auth — caller must enforce).
 */
export async function performGenerateCardsPhase(
  lectureId: string,
  phase: DeckPhase
): Promise<GenerateCardsStepResult> {
  const started = Date.now();
  await connectDB();

  try {
    const lecture = (await Lecture.findById(lectureId).lean()) as ILecture | null;
    if (!lecture) {
      return { ok: false, error: "Lecture not found" };
    }

    const course = (await Course.findById(lecture.courseId)
      .select("cardCoverageMode")
      .lean()) as Pick<ICourse, "cardCoverageMode"> | null;
    const coverageMode: CardCoverageMode = parseCardCoverageMode(
      course?.cardCoverageMode,
      "balanced"
    );

    const facts = await Fact.find({ lectureId }).sort({ createdAt: 1 }).lean();
    if (!facts.length) {
      await recordPipelineSystemError({
        lectureId,
        stage: "generate_cards",
        errorMessage: "No facts found. Extract facts first.",
        errorType: "no_facts",
        metadata: { phase },
      });
      return { ok: false, error: "No facts found. Extract facts first." };
    }

    const forSelection = facts.map((f, originalIndex) => ({
      originalIndex,
      factText: f.factText,
      factType: f.factType,
      tags: f.tags ?? [],
      importance: f.importance,
      confidence: f.confidence,
    }));

    const factIds = facts.map((f) => f._id) as mongoose.Types.ObjectId[];
    const budget = computeLectureCardBudget(coverageMode, facts.length);

    if (phase === "full") {
      await setLectureStatusWithProgress(lectureId, "generating_cards");

      const {
        selected,
        originalIndexMap,
        clusters,
        droppedFactCount,
        factSelectionCap,
        factCapModeCeiling,
        factCapBudgetDerived,
      } = selectFactsForCardGeneration(forSelection, coverageMode, budget.maxCards);

      const compactSummary = `phase=full cov=${coverageMode} facts=${selected.length}/${facts.length} cl=${clusters.length} flt=${droppedFactCount} tgt=${budget.target} max=${budget.maxCards}`;
      logPipeline("generate_cards_start", lectureId, {
        phase: "full",
        factTotal: facts.length,
        factsInPrompt: selected.length,
        factSelectionCap,
        factCapModeCeiling,
        factCapBudgetDerived,
        selectedToMaxCardsRatio: Number(
          (selected.length / Math.max(1, budget.maxCards)).toFixed(3)
        ),
        clusters: clusters.length,
        coverageMode,
        targetCards: budget.target,
        minCards: budget.minCards,
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
          deckPhase: "full",
        }
      );

      await Card.deleteMany({ lectureId });

      const remapped = generated.map((card) => ({
        ...card,
        source_fact_indices: remapCardSourceIndices(
          card.source_fact_indices,
          originalIndexMap
        ),
      }));

      const deduped = deduplicateGeneratedCards(remapped);
      const capped = deduped.slice(0, budget.maxCards);

      const savedCount = await saveCardDocs(lectureId, capped, factIds, "expansion");

      await setLectureStatusWithProgress(lectureId, "ready");

      const elapsedMs = Date.now() - started;
      logPipeline("generate_cards_done", lectureId, {
        phase: "full",
        factTotal: facts.length,
        factsInPrompt: selected.length,
        factSelectionCap,
        modelCards: generated.length,
        afterDedupe: deduped.length,
        cardsSaved: savedCount,
        maxCards: budget.maxCards,
        elapsedMs,
      });

      return {
        ok: true,
        phase: "full",
        cardsCreated: savedCount,
        coverageMode,
        cardBudget: {
          target: budget.target,
          min: budget.minCards,
          max: budget.maxCards,
          scale: budget.scale,
        },
        factsInPrompt: selected.length,
        factClusterCount: clusters.length,
      };
    }

    if (phase === "initial") {
      await setLectureStatusWithProgress(lectureId, "generating_initial_cards");

      await Card.deleteMany({ lectureId });

      const mini = computeMiniDeckBudget(budget);
      const {
        selected,
        originalIndexMap,
        clusters,
        droppedFactCount,
        factSelectionCap,
        factCapModeCeiling,
        factCapBudgetDerived,
      } = selectFactsForCardGeneration(forSelection, coverageMode, mini.maxCards);

      const compactSummary = `phase=initial cov=${coverageMode} facts=${selected.length}/${facts.length} cl=${clusters.length} flt=${droppedFactCount} mini_tgt=${mini.target} mini_max=${mini.maxCards} full_max=${budget.maxCards}`;
      logPipeline("generate_cards_start", lectureId, {
        phase: "initial",
        factTotal: facts.length,
        factsInPrompt: selected.length,
        factSelectionCap,
        factCapModeCeiling,
        factCapBudgetDerived,
        clusters: clusters.length,
        coverageMode,
        targetCards: mini.target,
        minCards: mini.minCards,
        maxCards: mini.maxCards,
        fullBudgetMax: budget.maxCards,
      });

      const generated = await generateCardsFromFacts(
        selected.map((f) => ({
          factText: f.factText,
          factType: f.factType,
          tags: f.tags ?? [],
        })),
        {
          coverageMode,
          targetCardCount: mini.target,
          minCardCount: mini.minCards,
          maxCardCount: mini.maxCards,
          selectionSummary: compactSummary,
          deckPhase: "initial",
        }
      );

      const remapped = generated.map((card) => ({
        ...card,
        source_fact_indices: remapCardSourceIndices(
          card.source_fact_indices,
          originalIndexMap
        ),
      }));

      const deduped = deduplicateGeneratedCards(remapped);
      const capped = deduped.slice(0, mini.maxCards);

      const savedCount = await saveCardDocs(lectureId, capped, factIds, "initial");

      await setLectureStatusWithProgress(lectureId, "generating_remaining_cards");

      const elapsedMs = Date.now() - started;
      logPipeline("generate_cards_done", lectureId, {
        phase: "initial",
        factTotal: facts.length,
        factsInPrompt: selected.length,
        factSelectionCap,
        modelCards: generated.length,
        afterDedupe: deduped.length,
        cardsSaved: savedCount,
        miniMaxCards: mini.maxCards,
        elapsedMs,
      });

      return {
        ok: true,
        phase: "initial",
        cardsCreated: savedCount,
        coverageMode,
        factsInPrompt: selected.length,
        factClusterCount: clusters.length,
        miniDeckBudget: mini,
        fullBudget: {
          target: budget.target,
          min: budget.minCards,
          max: budget.maxCards,
          scale: budget.scale,
        },
      };
    }

    // remaining
    await setLectureStatusWithProgress(lectureId, "generating_remaining_cards");

    await Card.deleteMany({ lectureId, generationPhase: "expansion" });

    const initialCards = await Card.find({
      lectureId,
      generationPhase: "initial",
    }).lean();

    if (initialCards.length === 0) {
      const legacyCount = await Card.countDocuments({ lectureId });
      const err =
        legacyCount > 0
          ? "Deck has no mini-deck markers. Use phase=full to regenerate the full deck."
          : "No initial mini-deck found. Run generate-cards with { phase: \"initial\" } first.";
      await recordPipelineSystemError({
        lectureId,
        stage: "generate_cards",
        errorMessage: err,
        errorType: "missing_initial_deck",
        metadata: { phase: "remaining", legacyCount },
      });
      await setLectureStatusWithProgress(lectureId, "error");
      return {
        ok: false,
        error: err,
      };
    }

    const initialFronts = initialCards.map((c) => c.front);
    const slotsLeft = Math.max(0, budget.maxCards - initialCards.length);

    if (slotsLeft <= 0) {
      await setLectureStatusWithProgress(lectureId, "ready");
      return {
        ok: true,
        phase: "remaining",
        cardsCreated: 0,
        skipped: true,
        reason: "Deck already at budget max",
        coverageMode,
        cardBudget: {
          target: budget.target,
          min: budget.minCards,
          max: budget.maxCards,
          scale: budget.scale,
        },
      };
    }

    const usedFactIds = new Set<string>();
    for (const c of initialCards) {
      for (const fid of c.factIds ?? []) {
        usedFactIds.add(String(fid));
      }
    }

    let selectionPool = forSelection.filter((f) => {
      const oid = facts[f.originalIndex]?._id;
      return oid && !usedFactIds.has(String(oid));
    });
    if (selectionPool.length < 8) {
      selectionPool = forSelection;
    }

    const {
      selected,
      originalIndexMap,
      clusters,
      droppedFactCount,
      factSelectionCap,
      factCapModeCeiling,
      factCapBudgetDerived,
    } = selectFactsForCardGeneration(selectionPool, coverageMode, slotsLeft);

    const compactSummary = `phase=remaining cov=${coverageMode} facts=${selected.length}/${facts.length} cl=${clusters.length} flt=${droppedFactCount} slots=${slotsLeft} tgt=${budget.target} max=${budget.maxCards}`;
    logPipeline("generate_cards_start", lectureId, {
      phase: "remaining",
      factTotal: facts.length,
      factsInPrompt: selected.length,
      factSelectionCap,
      factCapModeCeiling,
      factCapBudgetDerived,
      clusters: clusters.length,
      coverageMode,
      targetCards: budget.target,
      slotsLeft,
      maxCards: budget.maxCards,
    });

    const remainingTarget = Math.max(
      1,
      Math.round((budget.minCards + slotsLeft) / 2)
    );
    const remMin = Math.max(1, Math.min(slotsLeft, budget.minCards));
    const remMax = slotsLeft;

    await touchLectureProgress(lectureId);

    const generated = await generateCardsFromFacts(
      selected.map((f) => ({
        factText: f.factText,
        factType: f.factType,
        tags: f.tags ?? [],
      })),
      {
        coverageMode,
        targetCardCount: Math.min(remainingTarget, remMax),
        minCardCount: remMin,
        maxCardCount: remMax,
        selectionSummary: compactSummary,
        deckPhase: "expansion",
        expansionExistingCardFronts: initialFronts,
      }
    );

    await touchLectureProgress(lectureId);

    const remapped = generated.map((card) => ({
      ...card,
      source_fact_indices: remapCardSourceIndices(
        card.source_fact_indices,
        originalIndexMap
      ),
    }));

    const pseudoInitial = initialFronts.map((front) => ({ front, back: "" }));
    let deduped = deduplicateGeneratedCardsAgainstExisting(remapped, pseudoInitial);
    deduped = deduplicateGeneratedCards(deduped);
    const capped = deduped.slice(0, slotsLeft);

    const savedCount = await saveCardDocs(lectureId, capped, factIds, "expansion");

    await touchLectureProgress(lectureId);

    await setLectureStatusWithProgress(lectureId, "ready");

    const elapsedMs = Date.now() - started;
    logPipeline("generate_cards_done", lectureId, {
      phase: "remaining",
      factTotal: facts.length,
      factsInPrompt: selected.length,
      factSelectionCap,
      modelCards: generated.length,
      afterDedupe: deduped.length,
      cardsSaved: savedCount,
      slotsLeft,
      elapsedMs,
    });

    return {
      ok: true,
      phase: "remaining",
      cardsCreated: savedCount,
      coverageMode,
      cardBudget: {
        target: budget.target,
        min: budget.minCards,
        max: budget.maxCards,
        scale: budget.scale,
      },
      factsInPrompt: selected.length,
      factClusterCount: clusters.length,
    };
  } catch (error: unknown) {
    console.error("performGenerateCardsPhase", lectureId, phase, error);
    await setLectureStatusWithProgress(lectureId, "error").catch(() => undefined);
    const msg = error instanceof Error ? error.message : "Failed to generate cards";
    await recordPipelineSystemError({
      lectureId,
      stage: "generate_cards",
      errorMessage: msg,
      errorType: "exception",
      metadata: { phase },
    });
    return {
      ok: false,
      error: msg,
    };
  }
}

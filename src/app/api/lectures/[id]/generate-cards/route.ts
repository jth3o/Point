import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAuthUserId } from "@/lib/auth-server";
import { isLectureOwnedByUser } from "@/lib/ownership";
import {
  performGenerateCardsPhase,
  type DeckPhase,
} from "@/lib/lecture-pipeline/generate-cards-step";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const started = Date.now();
  const { id } = await context.params;

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 });
    }
    const owned = await isLectureOwnedByUser(id, userId);
    if (!owned) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      phase?: string;
    };
    const phase: DeckPhase =
      body.phase === "initial" || body.phase === "remaining" || body.phase === "full"
        ? body.phase
        : "full";

    const result = await performGenerateCardsPhase(id, phase);

    if (!result.ok) {
      const isClient =
        result.error.includes("No facts found") ||
        result.error.includes("No initial mini-deck") ||
        result.error.includes("mini-deck markers");
      return NextResponse.json(
        { success: false, error: result.error },
        { status: isClient ? 400 : 500 }
      );
    }

    const elapsedMs = Date.now() - started;

    if (phase === "full") {
      return NextResponse.json({
        success: true,
        phase: "full",
        lectureId: id,
        cardsCreated: result.cardsCreated,
        cardCoverageMode: result.coverageMode,
        cardBudget: result.cardBudget,
        factsInPrompt: result.factsInPrompt,
        factClusterCount: result.factClusterCount,
        elapsedMs,
      });
    }

    if (phase === "initial") {
      return NextResponse.json({
        success: true,
        phase: "initial",
        lectureId: id,
        cardsCreated: result.cardsCreated,
        miniDeckBudget: result.miniDeckBudget,
        fullBudget: result.fullBudget,
        factsInPrompt: result.factsInPrompt,
        factClusterCount: result.factClusterCount,
        elapsedMs,
      });
    }

    return NextResponse.json({
      success: true,
      phase: "remaining",
      lectureId: id,
      cardsCreated: result.cardsCreated,
      skipped: result.skipped,
      reason: result.reason,
      cardCoverageMode: result.coverageMode,
      cardBudget: result.cardBudget,
      factsInPrompt: result.factsInPrompt,
      factClusterCount: result.factClusterCount,
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

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isCardOwnedByUser } from "@/lib/ownership";
import { Card, Fact } from "@/models";
import { generateCardHelp, type CardHelpMode } from "@/lib/services/card-help";

type RouteContext = { params: Promise<{ id: string }> };

const MODES: CardHelpMode[] = ["explain", "example"];

export async function POST(request: NextRequest, context: RouteContext) {
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
    const mode = body?.mode;
    if (!mode || !MODES.includes(mode)) {
      return NextResponse.json(
        { error: "body must include mode: 'explain' or 'example'" },
        { status: 400 }
      );
    }

    await connectDB();
    const card = await Card.findById(id).lean() as { lectureId?: unknown; front?: string; back?: string; topic?: string; factIds?: unknown[] } | null;
    if (!card || !card.lectureId || !(await isCardOwnedByUser(String(card.lectureId), userId))) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const factIds = card.factIds ?? [];
    const facts = factIds.length
      ? await Fact.find({ _id: { $in: factIds } }).select("factText supportingQuote").lean()
      : [];

    const text = await generateCardHelp(
      mode,
      { front: card.front ?? "", back: card.back ?? "", topic: card.topic ?? "" },
      facts.map((f) => ({ factText: f.factText, supportingQuote: f.supportingQuote }))
    );

    return NextResponse.json({ text });
  } catch (e) {
    console.error("POST /api/cards/[id]/help", e);
    return NextResponse.json(
      { error: "Failed to generate help" },
      { status: 500 }
    );
  }
}

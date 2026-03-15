import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-server";
import { isCardOwnedByUser } from "@/lib/ownership";
import { Card } from "@/models";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/cards/[id]/suspend
 * Set suspended to true or false. Body: { suspended: true } or { suspended: false }.
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

    const body = await request.json().catch(() => ({}));
    const suspended = body?.suspended;
    if (typeof suspended !== "boolean") {
      return NextResponse.json(
        { error: "body must include suspended: true or false" },
        { status: 400 }
      );
    }

    await connectDB();
    const existing = await Card.findById(id).select("lectureId").lean() as { lectureId?: unknown } | null;
    if (!existing?.lectureId || !(await isCardOwnedByUser(String(existing.lectureId), userId))) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    const card = await Card.findByIdAndUpdate(id, { suspended }, { new: true }).lean();
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json(card);
  } catch (e) {
    console.error("PATCH /api/cards/[id]/suspend", e);
    return NextResponse.json(
      { error: "Failed to update card" },
      { status: 500 }
    );
  }
}

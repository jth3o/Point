import { performSegment } from "./segment-step";
import { performExtractFacts } from "./extract-facts-step";
import { performGenerateCardsPhase } from "./generate-cards-step";
import { connectDB } from "@/lib/db";
import { Lecture } from "@/models";
import { queueDiag } from "./queue-diag-log";

/**
 * Full server-side pipeline: segment → extract facts → initial mini-deck → remaining deck.
 */
export async function runLecturePipeline(
  lectureId: string
): Promise<{ ok: boolean; error?: string }> {
  await connectDB();
  const lec = (await Lecture.findById(lectureId)
    .select("processingStatus")
    .lean()) as { processingStatus?: string } | null;
  queueDiag("runLecturePipeline.enter", {
    lectureId,
    processingStatus: lec?.processingStatus ?? "missing_doc",
  });

  const seg = await performSegment(lectureId);
  if (!seg.ok) return { ok: false, error: seg.error };

  const ext = await performExtractFacts(lectureId, { force: false });
  if (!ext.ok) return { ok: false, error: ext.error };

  const initial = await performGenerateCardsPhase(lectureId, "initial");
  if (!initial.ok) return { ok: false, error: initial.error };

  const remaining = await performGenerateCardsPhase(lectureId, "remaining");
  if (!remaining.ok) return { ok: false, error: remaining.error };

  return { ok: true };
}

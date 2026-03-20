import { openai } from "@/lib/openai";
import type { CardCoverageMode } from "@/lib/course-card-coverage";
import { CARD_GENERATION_PROMPT } from "@/lib/prompts/card-generation-prompt";
import { cardGenerationSchema } from "@/lib/schemas/card-generation-schema";
import type { IFact } from "@/models/Fact";

/** Output shape from OpenAI; source_fact_indices are 0-based into the facts array. */
export type GeneratedCard = {
  front: string;
  back: string;
  card_type: string;
  topic: string;
  difficulty_estimate: number;
  source_fact_indices: number[];
};

export type GenerateCardsFromFactsOptions = {
  coverageMode: CardCoverageMode;
  targetCardCount: number;
  minCardCount: number;
  maxCardCount: number;
  selectionSummary?: string;
};

function coverageUserGuidance(o: GenerateCardsFromFactsOptions): string {
  const band = `Aim for about ${o.targetCardCount} cards (course coverage: ${o.coverageMode}). Stay within ${o.minCardCount}–${o.maxCardCount} inclusive. Never exceed ${o.maxCardCount}.`;
  if (o.coverageMode === "high") {
    return `${band} Prefer **broad factual recall**: more cards, each testing one atomic point; do not merge unrelated facts into one vague card. Skip only junk or unscaffolded facts.`;
  }
  if (o.coverageMode === "compressed") {
    return `${band} Prefer **conceptual compression**: fewer, richer cards that capture principles and relationships; merge tightly related facts when one self-contained question covers them.`;
  }
  return `${band} Balance recall and compression: one main idea per card; merge obvious duplicates in wording.`;
}

/**
 * Generate cards from saved facts only (factText, factType, tags). No transcript or segment text.
 */
export async function generateCardsFromFacts(
  facts: Pick<IFact, "factText" | "factType" | "tags">[],
  options: GenerateCardsFromFactsOptions
): Promise<GeneratedCard[]> {
  const factsBlob = facts
    .map((f, i) => `[${i}] ${f.factText} (type: ${f.factType}${f.tags?.length ? `, tags: ${f.tags.join(", ")}` : ""})`)
    .join("\n\n");

  const extra = options.selectionSummary ? `\n${options.selectionSummary}\n` : "";
  const coverageBlock = coverageUserGuidance(options);

  const response = await openai.responses.create({
    model: "gpt-5.4",
    input: [
      { role: "system", content: CARD_GENERATION_PROMPT },
      {
        role: "user",
        content: `Facts (indexed by 0-based position):\n\n${factsBlob}\n${extra}\n${coverageBlock}\n\nGenerate atomic flashcards. Return only valid JSON matching the schema.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: cardGenerationSchema.name,
        schema: cardGenerationSchema.schema,
        strict: cardGenerationSchema.strict,
      },
    },
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("No structured card generation output from OpenAI.");
  }

  const parsed = JSON.parse(content) as { cards: GeneratedCard[] };
  return parsed.cards ?? [];
}

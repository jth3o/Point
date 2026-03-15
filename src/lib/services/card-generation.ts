import { openai } from "@/lib/openai";
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

/**
 * Generate cards from saved facts only (factText, factType, tags). No transcript or segment text.
 */
export async function generateCardsFromFacts(
  facts: Pick<IFact, "factText" | "factType" | "tags">[]
): Promise<GeneratedCard[]> {
  const factsBlob = facts
    .map((f, i) => `[${i}] ${f.factText} (type: ${f.factType}${f.tags?.length ? `, tags: ${f.tags.join(", ")}` : ""})`)
    .join("\n\n");

  const response = await openai.responses.create({
    model: "gpt-5.4",
    input: [
      { role: "system", content: CARD_GENERATION_PROMPT },
      {
        role: "user",
        content: `Facts (indexed by 0-based position):\n\n${factsBlob}\n\nGenerate atomic flashcards. Return only valid JSON matching the schema.`,
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

import { openai } from "@/lib/openai";
import { FACT_EXTRACTION_PROMPT } from "@/lib/prompts/fact-extraction-prompt";
import { factExtractionSchema } from "@/lib/schemas/fact-extraction-schema";

type ExtractFactsInput = {
  cleanedText: string;
  startTime: string;
  endTime: string;
};

export async function extractFactsFromSegment({
  cleanedText,
  startTime,
  endTime,
}: ExtractFactsInput) {
  const response = await openai.responses.create({
    model: "gpt-5.4",
    input: [
      {
        role: "system",
        content: FACT_EXTRACTION_PROMPT,
      },
      {
        role: "user",
        content: `
Transcript segment time range: ${startTime} to ${endTime}

Transcript text:
${cleanedText}
        `.trim(),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: factExtractionSchema.name,
        schema: factExtractionSchema.schema,
        strict: factExtractionSchema.strict,
      },
    },
  });

  const content = response.output_text;

  if (!content) {
    throw new Error("No structured fact extraction output returned from OpenAI.");
  }

  return JSON.parse(content) as {
    facts: Array<{
      fact_text: string;
      fact_type:
        | "definition"
        | "example"
        | "exception"
        | "comparison"
        | "process"
        | "terminology"
        | "classification"
        | "threshold"
        | "cause_effect"
        | "list_item"
        | "emphasis"
        | "other";
      supporting_quote: string;
      start_time: string;
      end_time: string;
      confidence: number;
      importance: "low" | "medium" | "high";
      tags: string[];
    }>;
  };
}
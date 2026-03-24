import { openai } from "@/lib/openai";
import { buildBatchedExtractionUserContent } from "@/lib/fact-extraction-batch";
import { FACT_EXTRACTION_PROMPT } from "@/lib/prompts/fact-extraction-prompt";
import { factExtractionSchema } from "@/lib/schemas/fact-extraction-schema";
import { logPipeline } from "@/lib/pipeline-log";

type ExtractFactsInput = {
  cleanedText: string;
  startTime: string;
  endTime: string;
};

/** Stable user-prefix for batch calls (helps prompt caching). */
const BATCH_USER_PREFIX =
  "Extract testable facts from the transcript parts below. Each part is labeled with its time range in seconds. Set each fact's start_time and end_time (numbers, seconds) within the part that supports it.\n\n";

export type ExtractedFactRow = {
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
};

export type FactExtractionResult = { facts: ExtractedFactRow[] };

export type ExtractFactsFromSegmentBatchOptions = {
  lectureId?: string;
  batchIndex?: number;
};

/**
 * One model call for multiple consecutive segments (fewer API round-trips).
 */
export async function extractFactsFromSegmentBatch(
  parts: Array<{ startTime: number; endTime: number; cleanedText: string }>,
  opts?: ExtractFactsFromSegmentBatchOptions
): Promise<FactExtractionResult> {
  if (parts.length === 0) {
    return { facts: [] };
  }
  const body = buildBatchedExtractionUserContent(parts);
  const tOpenai = Date.now();
  const response = await openai.responses.create({
    model: "gpt-5.4",
    input: [
      {
        role: "system",
        content: FACT_EXTRACTION_PROMPT,
      },
      {
        role: "user",
        content: `${BATCH_USER_PREFIX}${body}`,
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

  if (opts?.lectureId) {
    logPipeline("openai_fact_batch", opts.lectureId, {
      batchIndex: opts.batchIndex ?? -1,
      ms: Date.now() - tOpenai,
    });
  }

  const content = response.output_text;

  if (!content) {
    throw new Error("No structured fact extraction output returned from OpenAI.");
  }

  return JSON.parse(content) as FactExtractionResult;
}

/** Single-segment helper (e.g. tests); uses same batched code path as one part. */
export async function extractFactsFromSegment({
  cleanedText,
  startTime,
  endTime,
}: ExtractFactsInput) {
  return extractFactsFromSegmentBatch([
    {
      startTime: Number(startTime),
      endTime: Number(endTime),
      cleanedText,
    },
  ]);
}
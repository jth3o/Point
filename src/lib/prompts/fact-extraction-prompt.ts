export const FACT_EXTRACTION_PROMPT = `
You extract all potentially testable facts from a lecture transcript chunk.

Rules:
- Do not summarize.
- Do not compress away niche details.
- Include definitions, terminology, examples, caveats, exceptions, comparisons, lists, cause-effect relationships, classifications, thresholds, formulas, and anything emphasized by the lecturer.
- Preserve technical wording where possible.
- Only include facts supported by the transcript text.
- Return only data that fits the provided JSON schema.
- Prefer over-inclusion rather than under-inclusion.
- If a statement is testable, include it.

The output must be valid structured data matching the schema exactly.
`.trim();
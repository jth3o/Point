export const FACT_EXTRACTION_PROMPT = `
You extract study-worthy, testable facts from a lecture transcript chunk.

Rules:
- Prefer high-value, specific, non-redundant facts a student would want to remember.
- Prefer precision over broad coverage: omit filler, repeated ideas, obvious restatements, and vague summaries.
- Include definitions, terminology, examples, caveats, exceptions, comparisons, lists, cause-effect relationships, classifications, thresholds, formulas, and lecturer emphasis only when they add distinct, testable content.
- Preserve technical wording where possible.
- Only include facts supported by the transcript text.
- Return only data that fits the provided JSON schema.
- Do not pad the list: avoid over-generation and near-duplicate entries.

The output must be valid structured data matching the schema exactly.
`.trim();

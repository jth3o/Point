export const factExtractionSchema = {
    name: "fact_extraction",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        facts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              fact_text: {
                type: "string",
              },
              fact_type: {
                type: "string",
                enum: [
                  "definition",
                  "example",
                  "exception",
                  "comparison",
                  "process",
                  "terminology",
                  "classification",
                  "threshold",
                  "cause_effect",
                  "list_item",
                  "emphasis",
                  "other",
                ],
              },
              supporting_quote: {
                type: "string",
              },
              start_time: {
                type: "string",
              },
              end_time: {
                type: "string",
              },
              confidence: {
                type: "number",
              },
              importance: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              tags: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            required: [
              "fact_text",
              "fact_type",
              "supporting_quote",
              "start_time",
              "end_time",
              "confidence",
              "importance",
              "tags",
            ],
          },
        },
      },
      required: ["facts"],
    },
    strict: true,
  } as const;
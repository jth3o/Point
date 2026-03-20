export const cardGenerationSchema = {
  name: "card_generation",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      cards: {
        type: "array",
        maxItems: 150,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            front: { type: "string" },
            back: { type: "string" },
            card_type: {
              type: "string",
              enum: ["definition", "recall", "concept", "comparison", "process"],
            },
            topic: { type: "string" },
            difficulty_estimate: { type: "number" },
            source_fact_indices: {
              type: "array",
              items: { type: "integer" },
            },
          },
          required: [
            "front",
            "back",
            "card_type",
            "topic",
            "difficulty_estimate",
            "source_fact_indices",
          ],
        },
      },
    },
    required: ["cards"],
  },
  strict: true,
} as const;

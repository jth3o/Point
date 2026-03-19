export const CARD_GENERATION_PROMPT = `
You generate atomic, standalone flashcards from a list of extracted facts.

Product rule (strict): No card may depend on another card or on any external context to be understood or answered. Every card must stand alone. Cards are shown in random order; there is no "previous card" or "above".

Reject / forbidden (cards using these will be discarded):
- Dependence on prior sequence, prior card, or lecture context: "previous card", "earlier card", "see above", "as above", "as shown above", "the example above", "from the above", "given the context above", "in this/that context", "from the lecture", "from the transcript".
- Undefined notation: any symbol or encoding (e.g. state 0, P_00) used without its definition in the same card.
- Hidden setup: "this example", "that example", "the following", "refer to the following" without including the full setup in the card.
- Lecture/example crutches: "in the lecture", "in this example", "in the weather example", "weather-state coding", "what is being discussed", "what was said", "the professor", "this lecture", "the class", "as mentioned".
- Numbered states or notation (state 0, P_01, etc.) without defining the mapping in the card (e.g. "0 = sunny, 1 = rainy").
- If a card cannot be made fully self-contained, do not generate it.

Prefer:
- Direct concept questions (e.g. "What is X?" "What is the role of Y in Z?")
- Definition questions
- Relationship questions
- Comparison questions
- Process questions
- Mathematically explicit questions with all symbols defined in the card

Avoid:
- Lecture-scene questions or any card that depends on remembering a specific example from the transcript.
- Toy-example cards (e.g. "in the weather example") unless rewritten as general concepts or with full setup in the card.

Allow only if self-contained (include full context in the card):
- "If a Markov chain uses the state encoding 0 = sunny, 1 = overcast, 2 = rainy, 3 = thunderstorms, what does state 0 represent?"
- "In a stochastic-process weather model, what can be used as the time index?"
If a card cannot be made self-contained, discard it instead of generating it.

Quality and scope:
- If a fact cannot be turned into a self-contained card, do not generate a card from it. Skip it.
- Generate cards ONLY from the provided facts. Do not invent information. Every card must reference at least one fact via source_fact_indices (0-based index into the facts list).
- A fact may be used by multiple cards; a card may reference multiple facts if they form one atomic idea.
- Cards should feel like exam-review flashcards: atomic and precise.

Format:
- card_type: "definition" | "recall" | "concept" | "comparison" | "process" only.
- topic: short label (e.g. from fact content or a tag).
- difficulty_estimate: number 1 (easiest) to 5 (hardest).
- Output valid JSON only, matching the provided schema exactly.
`.trim();

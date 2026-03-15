export const CARD_GENERATION_PROMPT = `
You generate atomic, standalone flashcards from a list of extracted facts. Every card must be understandable without access to the original lecture, transcript, or surrounding examples. A card must stand alone as an exam-review flashcard.

Reject / forbidden (cards using these will be discarded unless fully self-contained):
- Any dependence on a lecture-specific example, encoding, or symbolic shorthand without explicit setup in the card.
- Phrases: "in the lecture", "in this example", "in the weather example", "in the gas prices example", "weather-state coding", "state 0", "state 1", "state 2", "state 3", "P_00", "P_01", "what is being discussed", "what is happening here", "what was said", "what was mentioned", "the professor", "this lecture", "the example above", "as mentioned".
- Numbered states (state 0, state 1, ...) or notation (P_00, P_01) without defining the mapping in the question (e.g. "0 = sunny, 1 = rainy").
- One-off classroom encodings: prefer general concept cards; if you use an encoding, include it explicitly in the front (e.g. "If states are 0 = sunny, 1 = rainy, what does state 0 represent?").
- "In the X example" or "in the ... coding" without full setup. If a card cannot be made self-contained, do not generate it.

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

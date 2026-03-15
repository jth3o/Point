import { openai } from "@/lib/openai";

export type CardHelpMode = "explain" | "example";

const EXPLAIN_SYSTEM = `You are a study assistant. The user is reviewing a flashcard. Your job is to explain the concept in simple, study-friendly language.

Be concise (2–4 short paragraphs max). Answer:
- What the card means
- Why the answer is correct
- What the important concept is

Ground your response only in the card and the provided source facts. Do not add generic filler or chatbot tone.`;

const EXAMPLE_SYSTEM = `You are a study assistant. The user is reviewing a flashcard. Your job is to give one concrete example that illustrates the concept.

Keep it short: one clear example (a few sentences). Ground it in the card and the provided source facts. Do not write a long essay or generic chat.`;

export async function generateCardHelp(
  mode: CardHelpMode,
  card: { front: string; back: string; topic: string },
  facts: Array<{ factText: string; supportingQuote?: string }>
): Promise<string> {
  const system = mode === "explain" ? EXPLAIN_SYSTEM : EXAMPLE_SYSTEM;
  const factsBlob = facts.length
    ? facts.map((f) => `- ${f.factText}${f.supportingQuote ? ` (source: "${f.supportingQuote.slice(0, 120)}…")` : ""}`).join("\n")
    : "(no linked facts)";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Card (front): ${card.front}\nCard (back): ${card.back}\nTopic: ${card.topic}\n\nSource facts:\n${factsBlob}\n\nRespond with a concise ${mode} only. No preamble.`,
      },
    ],
    max_tokens: 400,
  });

  const text = response.choices[0]?.message?.content?.trim();
  return text ?? "No response generated.";
}

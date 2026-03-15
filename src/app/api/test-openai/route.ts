import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function GET() {
  try {
    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: "Reply with exactly these two words: OpenAI connected",
    });

    return NextResponse.json({
      success: true,
      message: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to connect to OpenAI",
      },
      { status: 500 }
    );
  }
}
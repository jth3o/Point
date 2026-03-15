import { NextResponse } from "next/server";
import { extractFactsFromSegment } from "@/lib/services/fact-extraction";

export async function GET() {
  try {
    const result = await extractFactsFromSegment({
      startTime: "00:10:00.000",
      endTime: "00:10:45.000",
      cleanedText: `
Photosynthesis occurs in chloroplasts. The two major stages are the light-dependent reactions and the Calvin cycle.
The light-dependent reactions produce ATP and NADPH. The Calvin cycle uses ATP and NADPH to help build sugars.
Students often confuse where each stage occurs, so remember that the Calvin cycle takes place in the stroma.
      `.trim(),
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Fact extraction test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Fact extraction test failed",
      },
      { status: 500 }
    );
  }
}
/**
 * Run without DB or OpenAI: tests VTT parsing and segmentation.
 * Usage: npx tsx scripts/test-parse.ts [path-to.vtt]
 * Default: scripts/sample-lecture.vtt
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parseVtt } from "../src/lib/vtt-parser";
import { segmentTranscript } from "../src/lib/segmenter";

const defaultPath = join(process.cwd(), "scripts", "sample-lecture.vtt");
const vttPath = process.argv[2] || defaultPath;

console.log("VTT path:", vttPath);
const vttContent = readFileSync(vttPath, "utf-8");

const cues = parseVtt(vttContent);
console.log("\nParsed cues:", cues.length);
cues.forEach((c, i) => {
  console.log(`  [${i}] ${c.startTime.toFixed(1)}s–${c.endTime.toFixed(1)}s: ${c.text.slice(0, 50)}${c.text.length > 50 ? "…" : ""}`);
});

const chunks = segmentTranscript(cues, { maxChunkChars: 200 });
console.log("\nSegments:", chunks.length);
chunks.forEach((s, i) => {
  console.log(`  [${i + 1}] ${s.startTime.toFixed(1)}s–${s.endTime.toFixed(1)}s: ${s.cleanedText.slice(0, 60)}…`);
});

console.log("\nDone.");

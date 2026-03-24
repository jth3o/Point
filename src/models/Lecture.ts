import mongoose from "mongoose";

export type UploadStatus = "pending" | "uploaded" | "failed";
export type ProcessingStatus =
  | "idle"
  | "queued"
  | "parsing"
  | "parsed"
  | "segmenting"
  | "segmented"
  | "extracting"
  | "extracted"
  | "facts_ready"
  /** Legacy single-pass card generation */
  | "generating_cards"
  | "generating_initial_cards"
  | "generating_remaining_cards"
  | "ready"
  | "error";

export interface ILecture {
  _id: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  title: string;
  filename: string;
  uploadStatus: UploadStatus;
  processingStatus: ProcessingStatus;
  /** Raw VTT content stored after upload for reprocessing if needed */
  vttContent?: string;
  createdAt: Date;
  /** When the current pipeline run was claimed from the queue */
  processingStartedAt?: Date;
  /** Last heartbeat / step boundary (for stale detection) */
  lastProgressAt?: Date;
  /** Increments each time a lecture is claimed from queued (cap stale retries) */
  processingAttemptCount?: number;
  /** Correlates one claim→ready run (cleared on ready) */
  currentRunId?: string;
}

const lectureSchema = new mongoose.Schema<ILecture>(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    filename: { type: String, required: true },
    uploadStatus: {
      type: String,
      enum: ["pending", "uploaded", "failed"],
      default: "pending",
    },
    processingStatus: {
      type: String,
      enum: [
        "idle",
        "queued",
        "parsing",
        "parsed",
        "segmenting",
        "segmented",
        "extracting",
        "extracted",
        "facts_ready",
        "generating_cards",
        "generating_initial_cards",
        "generating_remaining_cards",
        "ready",
        "error",
      ],
      default: "idle",
    },
    vttContent: { type: String },
    createdAt: { type: Date, default: Date.now },
    processingStartedAt: { type: Date },
    lastProgressAt: { type: Date },
    processingAttemptCount: { type: Number, default: 0 },
    currentRunId: { type: String },
  },
  { timestamps: false }
);

export const Lecture =
  mongoose.models.Lecture ?? mongoose.model<ILecture>("Lecture", lectureSchema);

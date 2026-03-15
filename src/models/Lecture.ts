import mongoose from "mongoose";

export type UploadStatus = "pending" | "uploaded" | "failed";
export type ProcessingStatus =
  | "idle"
  | "parsing"
  | "parsed"
  | "segmenting"
  | "segmented"
  | "extracting"
  | "extracted"
  | "facts_ready"
  | "generating_cards"
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
        "parsing",
        "parsed",
        "segmenting",
        "segmented",
        "extracting",
        "extracted",
        "facts_ready",
        "generating_cards",
        "ready",
        "error",
      ],
      default: "idle",
    },
    vttContent: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Lecture =
  mongoose.models.Lecture ?? mongoose.model<ILecture>("Lecture", lectureSchema);

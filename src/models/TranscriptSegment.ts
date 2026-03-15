import mongoose from "mongoose";

export interface ITranscriptSegment {
  _id: mongoose.Types.ObjectId;
  lectureId: mongoose.Types.ObjectId;
  sequence: number;
  startTime: number; // seconds
  endTime: number; // seconds
  rawText: string;
  cleanedText: string;
  topicLabel?: string;
  createdAt: Date;
}

const transcriptSegmentSchema = new mongoose.Schema<ITranscriptSegment>(
  {
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
    },
    sequence: { type: Number, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    rawText: { type: String, required: true },
    cleanedText: { type: String, required: true },
    topicLabel: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Compound index for listing segments by lecture in order
transcriptSegmentSchema.index({ lectureId: 1, sequence: 1 });

export const TranscriptSegment =
  mongoose.models.TranscriptSegment ??
  mongoose.model<ITranscriptSegment>("TranscriptSegment", transcriptSegmentSchema);

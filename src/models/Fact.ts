import mongoose from "mongoose";

export interface IFact {
  _id: mongoose.Types.ObjectId;
  lectureId: mongoose.Types.ObjectId;
  segmentId: mongoose.Types.ObjectId;
  factText: string;
  factType: string;
  supportingQuote: string;
  startTime: number;
  endTime: number;
  confidence: number;
  importance: "low" | "medium" | "high";
  tags: string[];
  approved: boolean;
  createdAt: Date;
}

const factSchema = new mongoose.Schema<IFact>(
  {
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TranscriptSegment",
      required: true,
    },
    factText: { type: String, required: true },
    factType: { type: String, required: true },
    supportingQuote: { type: String, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    confidence: { type: Number, required: true },
    importance: { type: String,enum: ["low", "medium", "high"], required: true },
    tags: { type: [String], default: [] },
    approved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

factSchema.index({ lectureId: 1 });
factSchema.index({ segmentId: 1 });

export const Fact =
  mongoose.models.Fact ?? mongoose.model<IFact>("Fact", factSchema);

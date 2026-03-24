import mongoose from "mongoose";

export type CardGenerationPhase = "initial" | "expansion";

export interface ICard {
  _id: mongoose.Types.ObjectId;
  lectureId: mongoose.Types.ObjectId;
  factIds: mongoose.Types.ObjectId[];
  front: string;
  back: string;
  cardType: string;
  topic: string;
  difficultyEstimate: number;
  /** Mini-deck vs rest of deck (two-phase generation); omitted on older rows */
  generationPhase?: CardGenerationPhase;
  approved: boolean;
  suspended: boolean;
  createdAt: Date;
}

const cardSchema = new mongoose.Schema<ICard>(
  {
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
    },
    factIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Fact", required: true },
    ],
    front: { type: String, required: true },
    back: { type: String, required: true },
    cardType: { type: String, required: true },
    topic: { type: String, required: true },
    difficultyEstimate: { type: Number, required: true },
    generationPhase: {
      type: String,
      enum: ["initial", "expansion"],
    },
    approved: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

cardSchema.index({ lectureId: 1 });
cardSchema.index({ approved: 1, suspended: 1 });

export const Card =
  mongoose.models.Card ?? mongoose.model<ICard>("Card", cardSchema);

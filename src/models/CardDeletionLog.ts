import mongoose from "mongoose";
import type { CardDeleteReason } from "@/lib/card-deletion-reasons";

export interface ICardDeletionLog {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Card id at time of deletion (card document is removed after log). */
  cardId: mongoose.Types.ObjectId;
  lectureId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  deleteReason: CardDeleteReason;
  deletedAt: Date;
  snapshotFront: string;
  snapshotBack: string;
  snapshotCardType: string;
  snapshotTopic: string;
  snapshotDifficultyEstimate: number;
}

const cardDeletionLogSchema = new mongoose.Schema<ICardDeletionLog>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    deleteReason: {
      type: String,
      enum: ["not_relevant", "incorrect_information", "bad_wording"],
      required: true,
    },
    deletedAt: { type: Date, required: true, default: Date.now, index: true },
    snapshotFront: { type: String, required: true },
    snapshotBack: { type: String, required: true },
    snapshotCardType: { type: String, required: true },
    snapshotTopic: { type: String, required: true },
    snapshotDifficultyEstimate: { type: Number, required: true },
  },
  { timestamps: false }
);

cardDeletionLogSchema.index({ userId: 1, deletedAt: -1 });

export const CardDeletionLog =
  mongoose.models.CardDeletionLog ??
  mongoose.model<ICardDeletionLog>("CardDeletionLog", cardDeletionLogSchema);

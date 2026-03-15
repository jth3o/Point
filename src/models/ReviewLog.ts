import mongoose from "mongoose";

export type Rating = "again" | "hard" | "good" | "easy";

export interface IReviewLog {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  rating: Rating;
  reviewedAt: Date;
  previousState: string;
  newState: string;
  previousIntervalDays: number;
  newIntervalDays: number;
}

const reviewLogSchema = new mongoose.Schema<IReviewLog>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: "Card", required: true },
    rating: {
      type: String,
      enum: ["again", "hard", "good", "easy"],
      required: true,
    },
    reviewedAt: { type: Date, default: Date.now },
    previousState: { type: String, required: true },
    newState: { type: String, required: true },
    previousIntervalDays: { type: Number, required: true },
    newIntervalDays: { type: Number, required: true },
  },
  { timestamps: false }
);

reviewLogSchema.index({ userId: 1, cardId: 1, reviewedAt: -1 });

export const ReviewLog =
  mongoose.models.ReviewLog ??
  mongoose.model<IReviewLog>("ReviewLog", reviewLogSchema);

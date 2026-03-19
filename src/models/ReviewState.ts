import mongoose from "mongoose";

export type ReviewStateType = "new" | "learning" | "review" | "relearning";

export interface IReviewState {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  state: ReviewStateType;
  reps: number;
  lapseCount: number;
  intervalDays: number;
  easeFactor: number;
  /** Position in learning pipeline (0 = first short steps, 1 = before graduate). */
  learningStep: number;
  lastReviewedAt?: Date;
  nextDueAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewStateSchema = new mongoose.Schema<IReviewState>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: "Card", required: true },
    state: {
      type: String,
      enum: ["new", "learning", "review", "relearning"],
      required: true,
    },
    reps: { type: Number, default: 0 },
    lapseCount: { type: Number, default: 0 },
    intervalDays: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },
    learningStep: { type: Number, default: 0 },
    lastReviewedAt: { type: Date },
    nextDueAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

reviewStateSchema.index({ userId: 1, nextDueAt: 1 });
reviewStateSchema.index({ userId: 1, cardId: 1 }, { unique: true });

export const ReviewState =
  mongoose.models.ReviewState ??
  mongoose.model<IReviewState>("ReviewState", reviewStateSchema);

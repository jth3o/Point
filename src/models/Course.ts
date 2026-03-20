import mongoose from "mongoose";

/** Drives expected card volume for lectures in this course (~60 min baseline, scaled by facts). */
export type CourseCardCoverageMode = "high" | "balanced" | "compressed";

export interface ICourse {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  /** high = memorization-heavy, balanced = default, low = conceptual compression */
  cardCoverageMode?: CourseCardCoverageMode;
  createdAt: Date;
}

const courseSchema = new mongoose.Schema<ICourse>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    cardCoverageMode: {
      type: String,
      enum: ["high", "balanced", "compressed"],
      default: "balanced",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Course =
  mongoose.models.Course ?? mongoose.model<ICourse>("Course", courseSchema);

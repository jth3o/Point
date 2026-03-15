import mongoose from "mongoose";

export interface ICourse {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  createdAt: Date;
}

const courseSchema = new mongoose.Schema<ICourse>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Course =
  mongoose.models.Course ?? mongoose.model<ICourse>("Course", courseSchema);

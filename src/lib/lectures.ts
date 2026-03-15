import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Lecture } from "@/models";
import type { ILecture } from "@/models/Lecture";

export async function getLectureById(
  lectureId: string
): Promise<(ILecture & { _id: mongoose.Types.ObjectId }) | null> {
  if (!mongoose.Types.ObjectId.isValid(lectureId)) return null;
  await connectDB();
  const lecture = await Lecture.findById(lectureId).lean();
  return lecture as (ILecture & { _id: mongoose.Types.ObjectId }) | null;
}

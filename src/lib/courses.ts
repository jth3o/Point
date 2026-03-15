import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models";
import type { ICourse } from "@/models/Course";

export async function getCourseById(
  courseId: string,
  userId: mongoose.Types.ObjectId
): Promise<(ICourse & { _id: mongoose.Types.ObjectId }) | null> {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  await connectDB();
  const course = await Course.findOne({ _id: courseId, userId }).lean();
  return course as (ICourse & { _id: mongoose.Types.ObjectId }) | null;
}

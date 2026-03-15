import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course, Lecture } from "@/models";

/**
 * Get all lecture IDs that belong to the user (via course ownership).
 */
export async function getLectureIdsForUser(
  userId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> {
  await connectDB();
  const courses = await Course.find({ userId }).select("_id").lean();
  const courseIds = courses.map((c) => c._id);
  const lectures = await Lecture.find({ courseId: { $in: courseIds } }).select("_id").lean();
  return lectures.map((l) => l._id) as mongoose.Types.ObjectId[];
}

/**
 * Check if a lecture belongs to the user (its course has userId).
 */
export async function isLectureOwnedByUser(
  lectureId: string,
  userId: mongoose.Types.ObjectId
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(lectureId)) return false;
  await connectDB();
  const lecture = await Lecture.findById(lectureId).select("courseId").lean() as { courseId?: unknown } | null;
  if (!lecture?.courseId) return false;
  const course = await Course.findById(lecture.courseId).select("userId").lean() as { userId?: unknown } | null;
  return course != null && String(course.userId) === String(userId);
}

/**
 * Check if a card (by lectureId) belongs to the user.
 */
export async function isCardOwnedByUser(
  cardLectureId: string,
  userId: mongoose.Types.ObjectId
): Promise<boolean> {
  return isLectureOwnedByUser(cardLectureId, userId);
}

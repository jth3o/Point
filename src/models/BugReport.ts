import mongoose from "mongoose";

export type BugReportSource = "user_report" | "system_error";
export type BugReportStatus = "new" | "reviewed" | "resolved" | "ignored";

export interface IBugReport {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  lectureId?: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  route?: string;
  description: string;
  whatUserWasDoing?: string;
  processingStatus?: string;
  segmentCount?: number;
  factCount?: number;
  cardCount?: number;
  userAgent?: string;
  environment?: string;
  source: BugReportSource;
  errorType?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  status: BugReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const bugReportSchema = new mongoose.Schema<IBugReport>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userEmail: { type: String },
    lectureId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecture" },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    route: { type: String },
    description: { type: String, required: true },
    whatUserWasDoing: { type: String },
    processingStatus: { type: String },
    segmentCount: { type: Number },
    factCount: { type: Number },
    cardCount: { type: Number },
    userAgent: { type: String },
    environment: { type: String },
    source: {
      type: String,
      enum: ["user_report", "system_error"],
      required: true,
    },
    errorType: { type: String },
    errorMessage: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["new", "reviewed", "resolved", "ignored"],
      default: "new",
    },
  },
  { timestamps: true }
);

export const BugReport =
  mongoose.models.BugReport ??
  mongoose.model<IBugReport>("BugReport", bugReportSchema);

import mongoose from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  createdAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const User =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);

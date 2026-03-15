import { auth } from "@/auth";
import mongoose from "mongoose";

/**
 * Get the current session. Returns null if not authenticated.
 */
export async function getSession() {
  return auth();
}

/**
 * Require auth: returns the session user id as ObjectId for use with Mongoose.
 * Use in API routes; returns null if not authenticated (caller should return 401).
 */
export async function getAuthUserId(): Promise<mongoose.Types.ObjectId | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id || typeof id !== "string") return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}


import { connectDB } from "@/lib/db";
import { User } from "@/models";

const DEFAULT_EMAIL = "default@point.local";
const DEFAULT_NAME = "Default User";

/**
 * For MVP (Phase 1–2) without auth: get or create a single default user.
 * Later replace with real auth and pass userId from session.
 */
export async function getDefaultUserId(): Promise<import("mongoose").Types.ObjectId> {
  await connectDB();
  let user = await User.findOne({ email: DEFAULT_EMAIL });
  if (!user) {
    user = await User.create({ email: DEFAULT_EMAIL, name: DEFAULT_NAME });
  }
  return user._id;
}

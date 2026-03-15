import { MongoClient } from "mongodb";

/**
 * Native MongoDB client for Auth.js adapter. Uses same MONGODB_URI as Mongoose.
 * Adapter accepts Promise<MongoClient> and connects on first use.
 */
function getAuthClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required for auth");
  return MongoClient.connect(uri);
}

let cached: Promise<MongoClient> | null = null;

export function getAuthMongoClient(): Promise<MongoClient> {
  if (!cached) cached = getAuthClientPromise();
  return cached;
}

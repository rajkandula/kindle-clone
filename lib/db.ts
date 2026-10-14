import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse a single connection across hot reloads / route invocations
const globalWithMongoose = global as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cached: MongooseCache = globalWithMongoose._mongoose ?? {
  conn: null,
  promise: null,
};
globalWithMongoose._mongoose = cached;

/** 1 = connected. Anything else means the socket died while this instance
 *  was frozen between invocations, and reusing it would fail immediately
 *  (bufferCommands is off). */
function isLive(conn: typeof mongoose | null): boolean {
  return conn?.connection.readyState === 1;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (isLive(cached.conn)) return cached.conn!;

  // Cached handle is stale — drop it so we reconnect instead of throwing
  if (cached.conn) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and configure it."
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import { User, hasPlus } from "./models";

const COOKIE_NAME = "lectoire_session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Copy .env.example to .env.local and configure it."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: "user" | "admin";
  /** Lectoire Plus access (subscriber or admin). */
  plus: boolean;
}

/**
 * Returns the logged-in user only if the session token is valid AND the user
 * still exists in the database — a valid token for a deleted user must not
 * count as logged in, or /login and /home redirect at each other forever.
 */
export async function getVerifiedUser(): Promise<SessionUser | null> {
  const userId = await getSession();
  if (!userId) return null;
  try {
    await connectDB();
    const user = await User.findById(userId).select("name username role subscription");
    if (!user) return null;
    return {
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      role: user.role === "admin" ? "admin" : "user",
      plus: hasPlus(user),
    };
  } catch {
    return null;
  }
}

/** The logged-in user, only if they are a company admin. */
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getVerifiedUser();
  return user?.role === "admin" ? user : null;
}

/** Returns the logged-in user's id, or null. */
export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

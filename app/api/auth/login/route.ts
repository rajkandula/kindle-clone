import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    // The field is one box in the UI, so accept either. `username` is still
    // read for older clients that send that name.
    const identifier =
      typeof body?.identifier === "string"
        ? body.identifier.trim().toLowerCase()
        : typeof body?.username === "string"
          ? body.username.trim().toLowerCase()
          : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Enter your username or email, and your password." },
        { status: 400 }
      );
    }

    await connectDB();
    // An "@" can only be an email; usernames cannot contain one.
    const user = identifier.includes("@")
      ? await User.findOne({ email: identifier })
      : await User.findOne({ username: identifier });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Wrong username, email, or password." },
        { status: 401 }
      );
    }

    await createSession(user._id.toString());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}

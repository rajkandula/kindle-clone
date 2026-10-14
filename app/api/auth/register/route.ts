import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, FOUNDING_SPOTS, FOUNDING_MONTHS } from "@/lib/models";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const username =
      typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || name.length > 80) {
      return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    }
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username: 3-20 chars, lowercase letters, numbers, _ or ." },
        { status: 400 }
      );
    }
    // Deliberately permissive: the only reliable proof an address works is
    // sending to it. This rejects obvious typos, not unusual-but-valid mail.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    await connectDB();
    const existing = await User.findOne({ username });
    if (existing) {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }
    const emailTaken = await User.findOne({ email });
    if (emailTaken) {
      return NextResponse.json(
        { error: "An account already uses that email." },
        { status: 409 }
      );
    }

    // Launch offer: the first members get Plus free for a month. Counted from
    // the flag rather than total users, so deleting a test account doesn't
    // quietly hand out an extra spot.
    const claimed = await User.countDocuments({ foundingMember: true });
    const founding = claimed < FOUNDING_SPOTS;
    const freeUntil = new Date();
    freeUntil.setMonth(freeUntil.getMonth() + FOUNDING_MONTHS);

    const user = await User.create({
      name,
      username,
      email,
      passwordHash: await hashPassword(password),
      foundingMember: founding,
      ...(founding
        ? {
            subscription: {
              status: "active",
              stripeCustomerId: "",
              // No Stripe subscription behind it — hasPlus enforces the end date
              stripeSubscriptionId: "",
              currentPeriodEnd: freeUntil,
              cancelAtPeriodEnd: false,
            },
          }
        : {}),
    });
    await createSession(user._id.toString());
    return NextResponse.json({ ok: true, founding });
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}

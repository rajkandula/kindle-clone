import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { ContactMessage } from "@/lib/models";
import { notifyAdmin } from "@/lib/email";
import { PUBLIC_ORIGIN } from "@/lib/site";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Public contact form. Signed-in senders get linked to their account. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body?.email === "string" ? body.email.trim().slice(0, 200) : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 5000) : "";

  if (!name || !subject || !message) {
    return NextResponse.json({ error: "Please fill in every field." }, { status: 400 });
  }
  if (!EMAIL_RX.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  await connectDB();

  // Light abuse guard: cap identical-sender volume
  const recent = await ContactMessage.countDocuments({
    email,
    createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recent >= 5) {
    return NextResponse.json(
      { error: "You've sent a few messages already — give us a little time to reply." },
      { status: 429 }
    );
  }

  const user = await getVerifiedUser();
  await ContactMessage.create({
    userId: user?.id ?? null,
    name,
    email,
    subject,
    message,
  });

  // Copy to the team inbox so it is seen the hour it arrives, not the next
  // time someone opens the admin panel. Reply-To is the sender, so answering
  // is one click. Fire-and-forget: the form must not wait on mail delivery.
  notifyAdmin(
    `Contact: ${subject}`,
    `${name} <${email}>${user ? ` · @${user.username}` : ""}\n\n${message}\n\nAlso in the admin inbox: ${PUBLIC_ORIGIN}/admin/messages`,
    email
  );

  return NextResponse.json({ ok: true });
}

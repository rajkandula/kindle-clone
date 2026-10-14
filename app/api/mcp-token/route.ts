import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { User } from "@/lib/models";

/** Generate (or rotate) the user's personal MCP access token. */
export async function POST() {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = `emb_${randomBytes(24).toString("hex")}`;
  await connectDB();
  await User.updateOne({ _id: userId }, { $set: { mcpToken: token } });
  return NextResponse.json({ token });
}

/** Revoke the token — MCP clients using it stop working immediately. */
export async function DELETE() {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await User.updateOne({ _id: userId }, { $set: { mcpToken: "" } });
  return NextResponse.json({ ok: true });
}

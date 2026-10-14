import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { OAuthToken } from "@/lib/models";

/** Disconnect a Claude app: revokes its access + refresh tokens. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  await OAuthToken.deleteOne({ _id: id, userId: user.id });
  return NextResponse.json({ ok: true });
}

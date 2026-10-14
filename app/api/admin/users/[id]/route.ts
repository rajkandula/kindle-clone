import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAdminUser } from "@/lib/auth";
import { User } from "@/lib/models";

/** Admin: change a user's role. Body: { role: "user" | "admin" } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (id === admin.id) {
    return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const role = body?.role === "admin" ? "admin" : body?.role === "user" ? "user" : null;
  if (!role) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await connectDB();
  const result = await User.updateOne({ _id: id }, { $set: { role } });
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

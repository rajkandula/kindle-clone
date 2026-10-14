import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAdminUser } from "@/lib/auth";
import { ContactMessage, CONTACT_STATUSES, type ContactStatus } from "@/lib/models";

/** Admin: update a contact message's status (new / read / replied). */
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

  const body = await req.json().catch(() => null);
  const status = body?.status as ContactStatus | undefined;
  if (!status || !CONTACT_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await connectDB();
  const updated = await ContactMessage.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true }
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, status: updated.status });
}

/** Admin: delete a contact message. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  await ContactMessage.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}

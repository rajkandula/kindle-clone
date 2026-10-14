import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Highlight, HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/models";

/** Recolor a highlight. Body: { color } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const color = body?.color as HighlightColor;
  if (!mongoose.isValidObjectId(id) || !HIGHLIGHT_COLORS.includes(color)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const result = await Highlight.updateOne({ _id: id, userId }, { $set: { color } });
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const result = await Highlight.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

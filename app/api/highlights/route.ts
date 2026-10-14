import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Book, Highlight, HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/models";

/** Create a highlight. Body: { bookId, chapterIndex, text, start, color } */
export async function POST(req: Request) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  const chapterIndex = Number(body?.chapterIndex);
  const text = typeof body?.text === "string" ? body.text : "";
  const start = Number(body?.start);
  const color = body?.color as HighlightColor;

  if (
    !mongoose.isValidObjectId(bookId) ||
    !Number.isInteger(chapterIndex) ||
    chapterIndex < 1 ||
    !text.trim() ||
    text.length > 1200 ||
    !Number.isFinite(start) ||
    start < 0 ||
    !HIGHLIGHT_COLORS.includes(color)
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const book = await Book.findById(bookId).select("status ownerId");
  if (!book || (book.status !== "published" && book.ownerId?.toString() !== userId)) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const count = await Highlight.countDocuments({ userId, bookId });
  if (count >= 500) {
    return NextResponse.json(
      { error: "Highlight limit reached for this book." },
      { status: 400 }
    );
  }

  const highlight = await Highlight.create({
    userId,
    bookId,
    chapterIndex,
    text,
    start: Math.round(start),
    color,
  });

  return NextResponse.json({
    highlight: {
      id: highlight._id.toString(),
      chapterIndex: highlight.chapterIndex,
      text: highlight.text,
      start: highlight.start,
      color: highlight.color,
    },
  });
}

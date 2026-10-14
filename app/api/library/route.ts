import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Book, LibraryEntry } from "@/lib/models";

const FIELDS = ["inLibrary", "wantToRead", "finished"] as const;
type Field = (typeof FIELDS)[number];

/** Toggle a shelf flag for a book. Body: { bookId, field, value } */
export async function POST(req: Request) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  const field = body?.field as Field;
  const value = Boolean(body?.value);

  if (!mongoose.isValidObjectId(bookId) || !FIELDS.includes(field)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const book = await Book.findById(bookId).select("status ownerId");
  if (!book || (book.status !== "published" && book.ownerId?.toString() !== userId)) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { [field]: value };
  // Finishing a book clears "want to read"
  if (field === "finished" && value) update.wantToRead = false;

  await LibraryEntry.findOneAndUpdate(
    { userId, bookId },
    { $set: update },
    { upsert: true, new: true }
  );

  return NextResponse.json({ ok: true });
}

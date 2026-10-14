import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Book, LibraryEntry } from "@/lib/models";

/**
 * Save reading position. Body: { bookId, chapterIndex, offset, chaptersRead }.
 * Progress percent is the share of chapters actually finished — jumping to
 * the last chapter doesn't mark the whole book read.
 */
export async function POST(req: Request) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  const chapterIndex = Number(body?.chapterIndex);
  const offset = Number(body?.offset);
  const chaptersRead: number[] = Array.isArray(body?.chaptersRead)
    ? [
        ...new Set<number>(
          (body.chaptersRead as unknown[])
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 1)
        ),
      ]
    : [];

  if (
    !mongoose.isValidObjectId(bookId) ||
    !Number.isFinite(chapterIndex) ||
    chapterIndex < 1
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const book = await Book.findById(bookId).select("chapterCount");
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const total = Math.max(1, book.chapterCount);
  const read = chaptersRead.filter((n) => n <= total).slice(0, 2000);
  const percent = Math.min(1, read.length / total);
  const finished = read.length >= total;

  await LibraryEntry.findOneAndUpdate(
    { userId, bookId },
    {
      $set: {
        progress: {
          chapterIndex: Math.round(chapterIndex),
          offset: Math.min(1, Math.max(0, offset || 0)),
          percent,
          chaptersRead: read.sort((a, b) => a - b),
        },
        lastReadAt: new Date(),
        ...(finished ? { finished: true, wantToRead: false } : {}),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

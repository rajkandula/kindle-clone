import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Chapter, Narration } from "@/lib/models";
import {
  DEFAULT_VOICE,
  narrateBook,
  narrationEnabled,
  readNarration,
} from "@/lib/audiobook";

export const maxDuration = 60;

/** How much of this book currently has up-to-date narration. */
export async function GET(
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
  const book = await Book.findOne({ _id: id, ownerId: user.id }).select("status");
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chapters = await Chapter.find({ bookId: id }).sort({ index: 1 }).select("index");
  let ready = 0;
  let preparing = 0;
  for (const c of chapters) {
    const state = await readNarration(id, c.index, DEFAULT_VOICE);
    if (state?.status === "ready") ready++;
    else if (state?.status === "preparing") preparing++;
  }

  return NextResponse.json({
    enabled: narrationEnabled(),
    published: book.status === "published",
    total: chapters.length,
    ready,
    preparing,
    outdated: chapters.length - ready - preparing,
  });
}

/**
 * Narrate (or re-narrate) the whole book on the author's say-so.
 *
 * Editing is deliberately NOT a trigger: only the author knows when they've
 * finished, and re-rendering on a guess wastes work on text that's about to
 * change again.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!narrationEnabled()) {
    return NextResponse.json({ error: "Narration isn't available." }, { status: 503 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const book = await Book.findOne({ _id: id, ownerId: user.id }).select("chapterCount");
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (book.chapterCount === 0) {
    return NextResponse.json({ error: "Write a chapter first." }, { status: 400 });
  }

  // Runs in the background; the editor polls GET for progress
  void narrateBook(book._id);

  // Drop records for text that no longer exists so the count reads true
  const live = await Chapter.find({ bookId: id }).select("index");
  Narration.deleteMany({
    bookId: id,
    chapterIndex: { $nin: live.map((c) => c.index) },
  }).catch(() => {});

  return NextResponse.json({ ok: true, started: book.chapterCount });
}

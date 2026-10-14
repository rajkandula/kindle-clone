import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  Book,
  Chapter,
  Conversation,
  GENRES,
  LibraryEntry,
  Message,
} from "@/lib/models";
import { isOwnBucketUrl } from "@/lib/storage";

/**
 * Update a book you own. Body may include: coverUrl (""" clears back to the
 * generated cover), title, subtitle, authorName, description, genre.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);

  await connectDB();
  const book = await Book.findOne({ _id: id, ownerId: userId });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  if (typeof body?.coverUrl === "string") {
    const coverUrl = body.coverUrl.trim();
    // Only accept media from our own bucket — never a client-supplied foreign URL
    if (coverUrl && !isOwnBucketUrl(coverUrl)) {
      return NextResponse.json({ error: "Invalid cover URL." }, { status: 400 });
    }
    book.coverUrl = coverUrl;
  }
  if (typeof body?.title === "string" && body.title.trim()) {
    book.title = body.title.trim().slice(0, 200);
  }
  if (typeof body?.subtitle === "string") {
    book.subtitle = body.subtitle.trim().slice(0, 300);
  }
  if (typeof body?.authorName === "string" && body.authorName.trim()) {
    book.authorName = body.authorName.trim().slice(0, 120);
  }
  if (typeof body?.description === "string") {
    book.description = body.description.trim().slice(0, 5000);
  }
  if (
    typeof body?.genre === "string" &&
    (GENRES as readonly string[]).includes(body.genre)
  ) {
    book.genre = body.genre;
  }
  await book.save();

  return NextResponse.json({ ok: true });
}

/** Delete a book you own, along with all its data. */
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
  const book = await Book.findOne({ _id: id, ownerId: userId });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const conversations = await Conversation.find({ bookId: book._id }).select("_id");
  await Promise.all([
    Chapter.deleteMany({ bookId: book._id }),
    LibraryEntry.deleteMany({ bookId: book._id }),
    Message.deleteMany({ conversationId: { $in: conversations.map((c) => c._id) } }),
    Conversation.deleteMany({ bookId: book._id }),
  ]);
  await book.deleteOne();

  return NextResponse.json({ ok: true });
}

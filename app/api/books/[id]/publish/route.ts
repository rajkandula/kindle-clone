import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Book } from "@/lib/models";
import { narrateBook } from "@/lib/audiobook";

/** Publish or unpublish a book you own. Body: { publish: boolean } */
export async function POST(
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
  const publish = Boolean(body?.publish);

  await connectDB();
  const book = await Book.findOne({ _id: id, ownerId: userId });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  if (publish) {
    if (book.chapterCount === 0) {
      return NextResponse.json(
        { error: "Write at least one chapter before publishing." },
        { status: 400 }
      );
    }
    if (!book.description) {
      return NextResponse.json(
        { error: "Add a description before publishing (ask the Studio to write one)." },
        { status: 400 }
      );
    }
    book.status = "published";
    book.publishedAt = new Date();
  } else {
    book.status = "draft";
  }
  await book.save();

  // Start narrating in the background so the audiobook is ready — or well
  // under way — by the time a reader opens it.
  if (publish) void narrateBook(book._id);

  return NextResponse.json({ ok: true, status: book.status });
}

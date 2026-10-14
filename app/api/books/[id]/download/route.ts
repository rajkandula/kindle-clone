import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Chapter } from "@/lib/models";
import { buildDownloadZip } from "@/lib/export";

export const maxDuration = 60;

/**
 * Download a book as a ZIP of every format (EPUB, PDF, DOCX, HTML, MD, TXT).
 * Owners can download their own books; company admins can download any book
 * (needed to print and fulfil orders).
 */
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
  const book =
    user.role === "admin"
      ? await Book.findById(id)
      : await Book.findOne({ _id: id, ownerId: user.id });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const chapters = await Chapter.find({ bookId: book._id })
    .sort({ index: 1 })
    .select("index title content");
  if (chapters.length === 0) {
    return NextResponse.json(
      { error: "This book has no chapters yet." },
      { status: 400 }
    );
  }

  const { buffer, filename } = await buildDownloadZip(
    {
      title: book.title,
      subtitle: book.subtitle,
      authorName: book.authorName,
      description: book.description,
      genre: book.genre,
      coverUrl: book.coverUrl,
      coverStyle: {
        palette: book.coverStyle?.palette ?? 0,
        layout: book.coverStyle?.layout ?? 0,
      },
    },
    chapters.map((c) => ({ index: c.index, title: c.title, content: c.content }))
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}

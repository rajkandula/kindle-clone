import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { accessToBook } from "@/lib/entitlement";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Chapter, Highlight, LibraryEntry } from "@/lib/models";
import { ReaderView } from "@/components/ReaderView";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { id } = await params;
  const { chapter } = await searchParams;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const book = await Book.findById(id);
  if (!book) notFound();
  const isOwn = book.ownerId?.toString() === user.id;
  if (book.status !== "published" && !isOwn) notFound();
  const access = await accessToBook(book, user);
  if (!access.allowed) {
    // A priced book is bought from its store page; everything else is Plus.
    redirect(
      access.reason === "needs-purchase"
        ? `/store/${book._id}?buy=1`
        : `/plus?locked=${encodeURIComponent(book.title)}`
    );
  }

  const [chapters, entry, highlights] = await Promise.all([
    Chapter.find({ bookId: book._id }).sort({ index: 1 }).select("index title content"),
    LibraryEntry.findOne({ userId: user.id, bookId: book._id }),
    Highlight.find({ userId: user.id, bookId: book._id }).sort({
      chapterIndex: 1,
      start: 1,
    }),
  ]);
  if (chapters.length === 0) notFound();

  const requested = chapter ? parseInt(chapter, 10) : NaN;
  const initialChapter = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), chapters.length)
    : Math.min(entry?.progress?.chapterIndex ?? 1, chapters.length);
  // Only restore scroll position when returning to the saved chapter
  const initialOffset =
    initialChapter === entry?.progress?.chapterIndex ? (entry?.progress?.offset ?? 0) : 0;
  // Pre-chaptersRead records: assume everything before the saved position was read
  const savedRead = entry?.progress?.chaptersRead;
  const initialReadChapters =
    savedRead && savedRead.length > 0
      ? savedRead
      : entry?.progress
        ? Array.from({ length: Math.max(0, entry.progress.chapterIndex - 1) }, (_, i) => i + 1)
        : [];

  return (
    <ReaderView
      book={{
        id: book._id.toString(),
        title: book.title,
        authorName: book.authorName,
      }}
      chapters={chapters.map((c) => ({
        index: c.index,
        title: c.title,
        content: c.content,
      }))}
      initialChapter={initialChapter}
      initialOffset={initialOffset}
      initialReadChapters={initialReadChapters}
      initialHighlights={highlights.map((h) => ({
        id: h._id.toString(),
        chapterIndex: h.chapterIndex,
        text: h.text,
        start: h.start,
        color: h.color,
      }))}
    />
  );
}

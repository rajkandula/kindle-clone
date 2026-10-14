import Link from "next/link";
import { Sparkles } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, LibraryEntry, toBookLite, type BookLite, type IBook } from "@/lib/models";
import { BookCard } from "@/components/BookCard";

export const metadata = { title: "Library" };
export const dynamic = "force-dynamic";

const SHELF_TITLES: Record<string, { title: string; empty: string }> = {
  all: { title: "All", empty: "Books you add, read, or write will appear here." },
  reading: { title: "Reading Now", empty: "Open any book to start reading — it'll show up here." },
  want: { title: "Want to Read", empty: "Mark books as Want to Read in the store." },
  finished: { title: "Finished", empty: "Books you finish will land on this shelf." },
  mine: { title: "My Books", empty: "Books you create in the Studio live here." },
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ shelf?: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { shelf: shelfParam } = await searchParams;
  const shelf = shelfParam && SHELF_TITLES[shelfParam] ? shelfParam : "all";
  await connectDB();

  let books: BookLite[] = [];

  if (shelf === "mine") {
    const mine = await Book.find({ ownerId: user.id }).sort({ updatedAt: -1 });
    books = mine.map((b) => toBookLite(b, user.id));
  } else {
    const filter: Record<string, unknown> = { userId: user.id };
    if (shelf === "reading") {
      filter.lastReadAt = { $ne: null };
      filter.finished = false;
    } else if (shelf === "want") filter.wantToRead = true;
    else if (shelf === "finished") filter.finished = true;
    else {
      filter.$or = [
        { inLibrary: true },
        { wantToRead: true },
        { finished: true },
        { lastReadAt: { $ne: null } },
      ];
    }

    const entries = await LibraryEntry.find(filter).sort({ updatedAt: -1 }).limit(120);
    const bookDocs = await Book.find({ _id: { $in: entries.map((e) => e.bookId) } });
    const byId = new Map<string, IBook>(bookDocs.map((b) => [b._id.toString(), b]));
    books = entries
      .map((e) => byId.get(e.bookId.toString()))
      .filter((b): b is IBook => Boolean(b))
      .map((b) => toBookLite(b, user.id));

    if (shelf === "all") {
      // Also surface the user's own creations on the All shelf
      const mine = await Book.find({ ownerId: user.id }).sort({ updatedAt: -1 });
      const seen = new Set(books.map((b) => b.id));
      for (const b of mine) {
        if (!seen.has(b._id.toString())) books.push(toBookLite(b, user.id));
      }
    }
  }

  const meta = SHELF_TITLES[shelf];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <p className="text-[13px] font-semibold tracking-wide text-faint uppercase">Library</p>
      <h1 className="font-display mb-5 text-4xl font-semibold tracking-tight">
        {meta.title}
      </h1>

      <div className="no-scrollbar -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1">
        {Object.entries(SHELF_TITLES).map(([key, s]) => (
          <Link
            key={key}
            href={key === "all" ? "/library" : `/library?shelf=${key}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              shelf === key
                ? "bg-ink text-white"
                : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {s.title}
          </Link>
        ))}
      </div>

      {books.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-book-sm">
          <p className="max-w-sm text-sm leading-relaxed text-muted">{meta.empty}</p>
          <div className="mt-5 flex gap-3">
            <Link
              href="/store"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
            >
              Browse the store
            </Link>
            <Link
              href="/studio/new"
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
            >
              <Sparkles className="h-4 w-4 text-accent" /> Write a book
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      )}
    </div>
  );
}

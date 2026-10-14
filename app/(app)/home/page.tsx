import Link from "next/link";
import { CloudDownload, Sparkles } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, LibraryEntry, toBookLite, type BookLite } from "@/lib/models";
import { Cover } from "@/components/Cover";
import { ShelfRow } from "@/components/BookCard";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

interface ContinueItem {
  book: BookLite;
  percent: number;
}

export default async function HomePage() {
  const user = (await getVerifiedUser())!;
  await connectDB();

  const [entries, bestsellers, fresh, free, community, drafts] = await Promise.all([
    LibraryEntry.find({
      userId: user.id,
      lastReadAt: { $ne: null },
      finished: false,
    })
      .sort({ lastReadAt: -1 })
      .limit(6),
    Book.find({ status: "published", "flags.bestseller": true }).limit(12),
    Book.find({ status: "published" }).sort({ publishedAt: -1 }).limit(12),
    Book.find({ status: "published", "flags.free": true }).limit(12),
    Book.find({ status: "published", ownerId: { $ne: null } })
      .sort({ publishedAt: -1 })
      .limit(12),
    Book.find({ ownerId: user.id, status: "draft" }).sort({ updatedAt: -1 }).limit(6),
  ]);

  const continueBooks: ContinueItem[] = (
    await Promise.all(
      entries.map(async (e) => {
        const book = await Book.findById(e.bookId);
        if (!book) return null;
        return {
          book: toBookLite(book, user.id),
          percent: Math.round((e.progress?.percent ?? 0) * 100),
        };
      })
    )
  ).filter((x): x is ContinueItem => x !== null);

  const lite = (books: (typeof bestsellers)[number][]) =>
    books.map((b) => toBookLite(b, user.id));

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <p className="text-[13px] font-semibold tracking-wide text-faint uppercase">{today}</p>
      <h1 className="font-display mb-8 text-4xl font-semibold tracking-tight">Home</h1>

      {/* Continue */}
      {continueBooks.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display mb-4 text-[22px] font-semibold tracking-tight">
            Continue
          </h2>
          <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
            {continueBooks.map(({ book, percent }) => (
              <Link
                key={book.id}
                href={`/read/${book.id}`}
                className="group flex w-72 shrink-0 items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-[#5c4a22] to-[#3d3117] p-4 text-white shadow-book-sm transition-shadow hover:shadow-book"
              >
                <Cover book={book} className="w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-snug font-semibold">
                    {book.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/70">{book.authorName}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-[11px] text-white/60">{percent}%</span>
                  </div>
                </div>
                <CloudDownload className="h-4 w-4 shrink-0 text-white/50" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* First-run hero when the shelf is empty */}
      {continueBooks.length === 0 && (
        <section className="mb-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-line bg-surface p-7 shadow-book-sm sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Welcome to Lectoire, {user.name.split(" ")[0]}
            </h2>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
              Pick something from the store to start reading — or open the Studio and
              write a book of your own with an AI co-writer.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link
              href="/store"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
            >
              Browse the store
            </Link>
            <Link
              href="/studio/new"
              className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
            >
              <Sparkles className="h-4 w-4" /> Create a book
            </Link>
          </div>
        </section>
      )}

      <div className="space-y-10">
        {drafts.length > 0 && (
          <ShelfRow
            title="Your books in progress"
            subtitle="Drafts from the Studio — keep writing."
            books={lite(drafts)}
            href="/studio"
          />
        )}
        <ShelfRow
          title="Current Bestsellers"
          subtitle="See what's popular right now."
          books={lite(bestsellers)}
          href="/store"
        />
        <ShelfRow
          title="New & Notable"
          subtitle="Fresh on the shelves."
          books={lite(fresh)}
          href="/store"
        />
        <ShelfRow
          title="Start Reading for Free"
          subtitle="Great books, no charge."
          books={lite(free)}
          href="/store"
        />
        <ShelfRow
          title="From the Community"
          subtitle="Published by Lectoire authors in the Studio."
          books={lite(community)}
          href="/store"
        />
      </div>
    </div>
  );
}

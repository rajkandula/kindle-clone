import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { BookOpenText, FileEdit, Package, PenLine, Sparkles, Upload } from "lucide-react";
import { computeOrderPricing, formatCents } from "@/lib/pricing";
import { connectDB } from "@/lib/db";
import { accessToBook } from "@/lib/entitlement";
import { BuyButton } from "@/components/BuyButton";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Chapter, Conversation, LibraryEntry, toBookLite } from "@/lib/models";
import { Cover } from "@/components/Cover";
import { ShelfRow } from "@/components/BookCard";
import { ShelfButtons } from "@/components/ShelfButtons";
import { PublishButton } from "@/components/PublishButton";
import { OwnerActions } from "@/components/OwnerActions";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const book = await Book.findById(id);
  if (!book) notFound();

  const isOwn = book.ownerId?.toString() === user.id;
  // Drafts are visible only to their owner
  if (book.status !== "published" && !isOwn) notFound();
  const access = await accessToBook(book, user);

  const [chapters, entry, similar, conversation] = await Promise.all([
    Chapter.find({ bookId: book._id }).sort({ index: 1 }).select("index title wordCount"),
    LibraryEntry.findOne({ userId: user.id, bookId: book._id }),
    Book.find({
      status: "published",
      genre: book.genre,
      _id: { $ne: book._id },
    }).limit(8),
    isOwn ? Conversation.findOne({ bookId: book._id }) : Promise.resolve(null),
  ]);

  const lite = toBookLite(book, user.id);
  const percent = Math.round((entry?.progress?.percent ?? 0) * 100);
  const readingTime = Math.max(1, Math.round(book.wordCount / 220));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-10 md:flex-row">
        {/* Cover column */}
        <div className="mx-auto w-56 shrink-0 md:mx-0 md:w-64">
          <Cover book={lite} className="shadow-book" />
          {isOwn && (
            <OwnerActions bookId={book._id.toString()} hasCustomCover={Boolean(book.coverUrl)} />
          )}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { v: String(book.chapterCount), k: "chapters" },
              { v: book.wordCount.toLocaleString(), k: "words" },
              { v: `${readingTime}m`, k: "read time" },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-line bg-surface py-2.5">
                <p className="text-sm font-bold">{s.v}</p>
                <p className="text-[10px] tracking-wide text-faint uppercase">{s.k}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Details column */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold tracking-wide text-accent-deep uppercase">
              {book.genre}
            </span>
            {book.flags.bestseller && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-800 uppercase">
                Bestseller
              </span>
            )}
            {book.flags.free && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 uppercase">
                Free
              </span>
            )}
            {book.status === "draft" && (
              <span className="rounded-full bg-stone-200 px-3 py-1 text-[11px] font-semibold tracking-wide text-stone-700 uppercase">
                Draft
              </span>
            )}
          </div>

          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance">
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="mt-1.5 text-lg text-muted">{book.subtitle}</p>
          )}
          <p className="mt-2 text-sm font-medium text-accent">{book.authorName}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {access.allowed ? (
              <Link
                href={`/read/${book._id}`}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep"
              >
                <BookOpenText className="h-4 w-4" />
                {percent > 0 ? `Continue Reading · ${percent}%` : "Read"}
              </Link>
            ) : access.reason === "needs-purchase" ? (
              <BuyButton bookId={book._id.toString()} priceCents={access.priceCents ?? 0} />
            ) : (
              <Link
                href={`/plus?locked=${encodeURIComponent(book.title)}`}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep"
              >
                <Sparkles className="h-4 w-4" />
                Read with Plus
              </Link>
            )}
            {book.chapterCount > 0 && (
              <Link
                href={`/order/${book._id}`}
                className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
              >
                <Package className="h-4 w-4" />
                Order print copy · {formatCents(computeOrderPricing(book, 1).total)}
              </Link>
            )}
            {isOwn && (
              <>
                <Link
                  href={`/edit/${book._id}`}
                  className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
                >
                  <FileEdit className="h-4 w-4" /> Edit
                </Link>
                <Link
                  href={
                    conversation
                      ? `/studio/${conversation._id}`
                      : `/studio/book/${book._id}`
                  }
                  className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
                >
                  <PenLine className="h-4 w-4" /> Open in Studio
                </Link>
                <PublishButton bookId={book._id.toString()} published={book.status === "published"} />
              </>
            )}
          </div>

          <div className="mt-5">
            <ShelfButtons
              bookId={book._id.toString()}
              initial={{
                inLibrary: entry?.inLibrary ?? false,
                wantToRead: entry?.wantToRead ?? false,
                finished: entry?.finished ?? false,
              }}
            />
          </div>

          {book.description && (
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="font-display mb-2.5 text-lg font-semibold">About this book</h2>
              <p className="max-w-2xl text-[15px] leading-relaxed whitespace-pre-line text-muted">
                {book.description}
              </p>
            </div>
          )}

          {chapters.length > 0 && (
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="font-display mb-3 text-lg font-semibold">Contents</h2>
              <ol className="max-w-2xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {chapters.map((c) => (
                  <li key={c.index}>
                    <Link
                      href={`/read/${book._id}?chapter=${c.index}`}
                      className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-raised"
                    >
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span className="w-6 shrink-0 font-mono text-xs text-faint">
                          {c.index}
                        </span>
                        <span className="truncate font-medium">{c.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-faint">
                        {c.wordCount.toLocaleString()} words
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {isOwn && chapters.length === 0 && (
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface p-5 text-sm text-muted">
              <Upload className="h-4 w-4 shrink-0" />
              No chapters yet — open this book in the Studio and start writing.
            </div>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-14">
          <ShelfRow
            title={`More in ${book.genre}`}
            books={similar.map((b) => toBookLite(b, user.id))}
          />
        </div>
      )}
    </div>
  );
}

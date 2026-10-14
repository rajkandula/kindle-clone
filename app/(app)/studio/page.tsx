import Link from "next/link";
import { Plug, Plus, Sparkles } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Conversation, toBookLite } from "@/lib/models";
import { Cover } from "@/components/Cover";
import { PlusUpsell } from "@/components/PlusUpsell";

export const metadata = { title: "Studio" };
export const dynamic = "force-dynamic";

export default async function StudioIndex() {
  const user = (await getVerifiedUser())!;
  await connectDB();

  /* Every owned book is a Studio project — including books created from the
     Claude connector or the editor, which have no conversation yet. */
  const [conversations, books] = await Promise.all([
    Conversation.find({ userId: user.id }).sort({ lastMessageAt: -1 }).limit(120),
    Book.find({ ownerId: user.id }).sort({ updatedAt: -1 }).limit(120),
  ]);
  const convByBook = new Map(conversations.map((c) => [c.bookId.toString(), c]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Studio</h1>
          <p className="mt-1 text-sm text-muted">
            Write books with an AI partner — it drafts real chapters while you talk.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/connections"
            className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
          >
            <Plug className="h-4 w-4 text-accent" /> Connections
          </Link>
          <Link
            href="/studio/new"
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep"
          >
            <Plus className="h-4 w-4" /> New book
          </Link>
        </div>
      </div>

      {!user.plus && books.length === 0 ? (
        <PlusUpsell context="Describe an idea and watch your AI writing partner turn it into a real book, chapter by chapter. Creating books is included with Lectoire Plus." />
      ) : books.length === 0 ? (
        <Link
          href="/studio/new"
          className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-20 text-center transition-colors hover:border-accent/50"
        >
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft">
            <Sparkles className="h-6 w-6 text-accent" />
          </span>
          <h2 className="font-display text-xl font-semibold">Write your first book</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
            Describe an idea — a novel, a guide, a children&apos;s story — and watch
            it become a real book, chapter by chapter.
          </p>
        </Link>
      ) : (
        <>
        {!user.plus && (
          <Link
            href="/plus?locked=studio"
            className="mb-5 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            Your Plus subscription has ended — resubscribe to keep writing with the AI Studio.
          </Link>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => {
            const conv = convByBook.get(book._id.toString());
            const lite = toBookLite(book, user.id);
            return (
              <Link
                key={book._id.toString()}
                href={conv ? `/studio/${conv._id}` : `/studio/book/${book._id}`}
                className="group flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-book-sm transition-shadow hover:shadow-book"
              >
                <Cover book={lite} className="w-20 shrink-0" />
                <div className="min-w-0 flex-1 py-1">
                  <h3 className="line-clamp-2 leading-snug font-semibold">
                    {book.title === "Untitled Book" ? "New book project" : book.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {book.chapterCount} chapter{book.chapterCount === 1 ? "" : "s"} ·{" "}
                    {book.wordCount.toLocaleString()} words
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {book.status === "published" ? "Published" : "Draft"} · updated{" "}
                    {new Date(conv?.lastMessageAt ?? book.updatedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" }
                    )}
                  </p>
                  <span className="mt-2 inline-block text-xs font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    Continue writing →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

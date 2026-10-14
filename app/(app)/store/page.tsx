import Link from "next/link";
import { BookOpenText, Sparkles } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, GENRES, toBookLite } from "@/lib/models";
import { BookCard, ShelfRow } from "@/components/BookCard";
import { Cover } from "@/components/Cover";

export const metadata = { title: "Book Store" };
export const dynamic = "force-dynamic";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { genre } = await searchParams;
  await connectDB();

  const activeGenre = genre && (GENRES as readonly string[]).includes(genre) ? genre : null;

  const [featured, all] = await Promise.all([
    activeGenre
      ? Promise.resolve([])
      : Book.find({ status: "published", "flags.featured": true }).limit(12),
    Book.find({
      status: "published",
      ...(activeGenre ? { genre: activeGenre } : {}),
    })
      .sort({ publishedAt: -1 })
      .limit(60),
  ]);

  const spotlight = featured[0] ?? null;
  const restFeatured = featured.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <h1 className="font-display mb-2 text-4xl font-semibold tracking-tight">
        Book Store
      </h1>
      <p className="mb-6 text-sm text-muted">
        Original books written in Lectoire — plus everything the community publishes.
      </p>

      {/* Genre chips */}
      <div className="no-scrollbar -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link
          href="/store"
          className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
            !activeGenre
              ? "bg-ink text-white"
              : "border border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          All
        </Link>
        {GENRES.map((g) => (
          <Link
            key={g}
            href={`/store?genre=${encodeURIComponent(g)}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              activeGenre === g
                ? "bg-ink text-white"
                : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {g}
          </Link>
        ))}
      </div>

      {/* Editorial spotlight */}
      {!activeGenre && spotlight && (
        <section className="mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[#211d19] via-[#2b241d] to-[#3d2c1a] text-white shadow-book">
          <div className="flex flex-col items-center gap-8 px-8 py-10 sm:flex-row sm:px-12">
            <Link
              href={`/store/${spotlight._id}`}
              className="w-40 shrink-0 -rotate-2 transition-transform duration-300 hover:rotate-0 sm:w-48"
            >
              <Cover book={toBookLite(spotlight, user.id)} className="shadow-book" />
            </Link>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[0.22em] text-amber-400 uppercase sm:justify-start">
                <Sparkles className="h-3.5 w-3.5" /> Featured this week
              </p>
              <h2 className="font-display text-3xl leading-tight font-semibold text-balance">
                {spotlight.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-white/60">
                {spotlight.authorName} · {spotlight.genre}
              </p>
              <p className="mx-auto mt-3 line-clamp-3 max-w-xl text-[14.5px] leading-relaxed text-white/80 sm:mx-0">
                {spotlight.description}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
                <Link
                  href={`/read/${spotlight._id}`}
                  className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber-400"
                >
                  <BookOpenText className="h-4 w-4" /> Start reading
                </Link>
                <Link
                  href={`/store/${spotlight._id}`}
                  className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Details
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {!activeGenre && restFeatured.length > 0 && (
        <div className="mb-10">
          <ShelfRow
            title="Also featured"
            books={restFeatured.map((b) => toBookLite(b, user.id))}
          />
        </div>
      )}

      <section className={activeGenre ? "" : "border-t border-line pt-6"}>
        <h2 className="font-display mb-4 text-[22px] font-semibold tracking-tight">
          {activeGenre ? activeGenre : "All Books"}
          <span className="ml-2 align-middle text-sm font-normal text-faint">
            {all.length}
          </span>
        </h2>
        {all.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
            Nothing here yet. Run{" "}
            <code className="rounded bg-raised px-1.5 py-0.5">npm run generate:catalog</code>{" "}
            to stock the store with Lectoire Originals, or publish a book from the Studio.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {all.map((b) => (
              <BookCard key={b._id.toString()} book={toBookLite(b, user.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

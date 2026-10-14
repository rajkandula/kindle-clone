import { Search as SearchIcon } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, toBookLite } from "@/lib/models";
import { BookCard } from "@/components/BookCard";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);
  await connectDB();

  let results: Awaited<ReturnType<typeof Book.find>> = [];
  if (query) {
    const rx = new RegExp(escapeRegex(query), "i");
    results = await Book.find({
      $and: [
        { $or: [{ status: "published" }, { ownerId: user.id }] },
        { $or: [{ title: rx }, { authorName: rx }, { description: rx }, { tags: rx }] },
      ],
    }).limit(40);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <p className="text-[13px] font-semibold tracking-wide text-faint uppercase">Discover</p>
      <h1 className="font-display mb-6 text-4xl font-semibold tracking-tight">Search</h1>

      <form action="/search" className="relative mb-10 max-w-xl">
        <SearchIcon className="absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
        <input
          name="q"
          defaultValue={query}
          placeholder="Titles, authors, tags…"
          autoFocus
          className="w-full rounded-full border border-line bg-surface py-3 pr-5 pl-11 text-[15px] shadow-book-sm outline-none transition-colors focus:border-accent"
        />
      </form>

      {query && (
        <>
          <p className="mb-5 text-sm text-muted">
            {results.length === 0
              ? `No results for “${query}”.`
              : `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”`}
          </p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((b) => (
              <BookCard key={b._id.toString()} book={toBookLite(b, user.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

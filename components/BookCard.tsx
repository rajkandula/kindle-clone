import Link from "next/link";
import { Cover } from "./Cover";
import type { BookLite } from "@/lib/models";

/** A book in a shelf row or grid: cover + title + author, links to detail. */
export function BookCard({
  book,
  size = "md",
}: {
  book: BookLite;
  size?: "sm" | "md";
}) {
  const width = size === "sm" ? "w-32" : "w-40";
  return (
    <Link href={`/store/${book.id}`} className={`group block shrink-0 ${width}`}>
      <div className="book-tilt relative rounded-md">
        <Cover book={book} />
        {/* Sold separately — say so while browsing, not after the click. */}
        {book.priceCents > 0 && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-ink/90 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            ${(book.priceCents / 100).toFixed(2)}
          </span>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-[13px] leading-snug font-semibold text-ink">
        {book.title}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{book.authorName}</p>
    </Link>
  );
}

/** Horizontal, scrollable shelf of books with a section heading. */
export function ShelfRow({
  title,
  subtitle,
  books,
  href,
}: {
  title: string;
  subtitle?: string;
  books: BookLite[];
  href?: string;
}) {
  if (books.length === 0) return null;
  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4">
        {href ? (
          <Link href={href} className="group inline-flex items-baseline gap-1.5">
            <h2 className="font-display text-[22px] font-semibold tracking-tight">
              {title}
            </h2>
            <span className="text-lg text-faint transition-transform group-hover:translate-x-0.5">
              ›
            </span>
          </Link>
        ) : (
          <h2 className="font-display text-[22px] font-semibold tracking-tight">{title}</h2>
        )}
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="no-scrollbar -mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
        {books.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}

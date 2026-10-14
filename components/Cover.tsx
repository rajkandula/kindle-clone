/* eslint-disable @next/next/no-img-element */
import { COVER_PALETTES } from "@/lib/covers";
import type { ICoverStyle } from "@/lib/models";

export interface CoverBook {
  title: string;
  authorName?: string;
  genre?: string;
  coverUrl?: string;
  coverStyle?: ICoverStyle;
}

/**
 * A book cover. Uploaded image if the book has one, otherwise a deterministic
 * generated cover (palette + layout stored on the book). Sizes fluidly via
 * container-query units, so the same component works at 40px or 400px wide.
 */
export function Cover({ book, className = "" }: { book: CoverBook; className?: string }) {
  if (book.coverUrl) {
    return (
      <div
        className={`book-spine relative aspect-2/3 overflow-hidden rounded-md bg-raised shadow-book-sm ${className}`}
      >
        <img
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  const style = book.coverStyle ?? { palette: 0, layout: 0 };
  const n = COVER_PALETTES.length;
  const p = COVER_PALETTES[((Math.round(style.palette) % n) + n) % n] ?? COVER_PALETTES[0];
  const layout = ((Math.round(style.layout) % 4) + 4) % 4;
  const author = book.authorName || "";

  return (
    <div
      className={`book-spine relative aspect-2/3 overflow-hidden rounded-md shadow-book-sm select-none ${className}`}
      style={{
        containerType: "inline-size",
        background: `linear-gradient(160deg, ${p.bg} 0%, ${p.bg2} 100%)`,
        color: p.fg,
      }}
    >
      {layout === 0 && (
        <div className="absolute inset-0 flex flex-col items-center px-[8cqw] py-[9cqw] text-center">
          <span
            className="font-medium tracking-[0.18em] uppercase opacity-80"
            style={{ fontSize: "4.6cqw" }}
          >
            {author}
          </span>
          <span
            className="mt-[4cqw] block h-px w-[26cqw]"
            style={{ background: p.accent, opacity: 0.9 }}
          />
          <div className="flex flex-1 items-center">
            <h3
              className="font-display leading-[1.15] font-semibold text-balance"
              style={{ fontSize: "10.5cqw" }}
            >
              {book.title}
            </h3>
          </div>
          <span style={{ color: p.accent, fontSize: "7cqw" }}>❦</span>
        </div>
      )}

      {layout === 1 && (
        <div className="absolute inset-0 flex flex-col">
          <span
            className="px-[8cqw] pt-[8cqw] font-medium tracking-[0.2em] uppercase opacity-75"
            style={{ fontSize: "4.4cqw" }}
          >
            {book.genre || "A novel"}
          </span>
          <div className="mt-auto">
            <div
              className="px-[8cqw] py-[6cqw]"
              style={{ background: p.accent, color: p.bg2 }}
            >
              <h3
                className="font-display leading-[1.12] font-bold text-balance"
                style={{ fontSize: "10cqw" }}
              >
                {book.title}
              </h3>
            </div>
            <p
              className="px-[8cqw] py-[5cqw] font-medium tracking-wide"
              style={{ fontSize: "5cqw" }}
            >
              {author}
            </p>
          </div>
        </div>
      )}

      {layout === 2 && (
        <div className="absolute inset-0">
          <span
            className="absolute rounded-full"
            style={{
              width: "70cqw",
              height: "70cqw",
              right: "-22cqw",
              top: "-18cqw",
              background: p.accent,
              opacity: 0.85,
            }}
          />
          <span
            className="absolute rounded-full border"
            style={{
              width: "34cqw",
              height: "34cqw",
              right: "8cqw",
              top: "34cqw",
              borderColor: p.fg,
              opacity: 0.35,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 px-[8cqw] pb-[8cqw]">
            <h3
              className="font-display leading-[1.12] font-semibold text-balance"
              style={{ fontSize: "10.5cqw" }}
            >
              {book.title}
            </h3>
            <p className="mt-[3cqw] font-medium opacity-80" style={{ fontSize: "5cqw" }}>
              {author}
            </p>
          </div>
        </div>
      )}

      {layout === 3 && (
        <div
          className="absolute flex flex-col items-center text-center"
          style={{ inset: "5cqw", border: `1.5px solid ${p.fg}55` }}
        >
          <div
            className="mt-[3cqw] flex flex-col items-center"
            style={{ borderBottom: `1px solid ${p.fg}40`, width: "80%" }}
          >
            <span
              className="pb-[3cqw] font-medium tracking-[0.22em] uppercase opacity-75"
              style={{ fontSize: "4.2cqw" }}
            >
              {book.genre || "A novel"}
            </span>
          </div>
          <div className="flex flex-1 items-center px-[7cqw]">
            <h3
              className="font-display leading-[1.18] font-semibold text-balance"
              style={{ fontSize: "9.5cqw" }}
            >
              {book.title}
            </h3>
          </div>
          <span
            className="mb-[5cqw] font-medium tracking-[0.14em] uppercase"
            style={{ fontSize: "4.6cqw", color: p.accent }}
          >
            {author}
          </span>
        </div>
      )}
    </div>
  );
}

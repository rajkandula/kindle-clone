/**
 * Generative book covers. Every book without an uploaded cover image gets a
 * deterministic SVG cover: palette + layout indices are stored on the book
 * (so the AI can restyle a cover), and the Cover component renders them.
 */

export interface CoverPalette {
  /** Background gradient stops. */
  bg: string;
  bg2: string;
  /** Title / author text. */
  fg: string;
  /** Decorative accent. */
  accent: string;
}

export const COVER_PALETTES: CoverPalette[] = [
  { bg: "#1e3a5f", bg2: "#0f1f33", fg: "#f5efe0", accent: "#e8b64c" }, // midnight & gold
  { bg: "#7c2d12", bg2: "#431407", fg: "#fdf3e7", accent: "#fdba74" }, // ember
  { bg: "#14532d", bg2: "#052e16", fg: "#ecfdf5", accent: "#86efac" }, // forest
  { bg: "#581c87", bg2: "#2e1065", fg: "#faf5ff", accent: "#d8b4fe" }, // violet hour
  { bg: "#9f1239", bg2: "#4c0519", fg: "#fff1f2", accent: "#fda4af" }, // crimson
  { bg: "#155e75", bg2: "#083344", fg: "#ecfeff", accent: "#67e8f9" }, // deep sea
  { bg: "#f5efe0", bg2: "#e7dcc3", fg: "#292524", accent: "#b45309" }, // parchment
  { bg: "#292524", bg2: "#171412", fg: "#f5f0e8", accent: "#d6a656" }, // ink & brass
  { bg: "#3b4a3a", bg2: "#1f2a1e", fg: "#f2f5ec", accent: "#c9d8a8" }, // sage
  { bg: "#1e293b", bg2: "#0f172a", fg: "#f1f5f9", accent: "#7dd3fc" }, // slate sky
  { bg: "#7e5a3c", bg2: "#4a3121", fg: "#fbf6ee", accent: "#f0c88a" }, // leather
  { bg: "#be5a38", bg2: "#7c3016", fg: "#fff7ed", accent: "#ffd7ba" }, // terracotta
];

export const COVER_LAYOUT_COUNT = 4;

export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Genres lean toward palettes that fit their mood. */
const GENRE_PALETTES: Record<string, number[]> = {
  Thriller: [0, 7, 9],
  Mystery: [0, 7, 3],
  Horror: [7, 4, 1],
  Romance: [4, 11, 6],
  "Sci-Fi": [9, 5, 3],
  Fantasy: [3, 0, 8],
  History: [10, 6, 7],
  Biography: [6, 10, 9],
  Business: [9, 6, 0],
  "Self-Help": [11, 2, 6],
  Poetry: [6, 8, 3],
  Adventure: [2, 5, 1],
  Children: [11, 2, 5],
  Fiction: [8, 1, 10],
};

export function coverStyleFor(
  title: string,
  genre: string
): { palette: number; layout: number } {
  const h = hashString(title + "::" + genre);
  const pool = GENRE_PALETTES[genre] ?? [h % COVER_PALETTES.length];
  return {
    palette: pool[h % pool.length],
    layout: (h >>> 3) % COVER_LAYOUT_COUNT,
  };
}

/** Client-safe genre list — no server imports here. */
export const GENRES = [
  "Fiction",
  "Thriller",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Fantasy",
  "Horror",
  "History",
  "Biography",
  "Business",
  "Self-Help",
  "Poetry",
  "Adventure",
  "Children",
] as const;
export type Genre = (typeof GENRES)[number];

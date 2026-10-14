/**
 * Real artwork, via xAI's Grok Imagine.
 *
 * Used for the two things readers actually judge a book on: its cover, and the
 * pictures inside it. Prompts are built from the book itself — title, genre,
 * blurb, the chapter being illustrated — so the art belongs to the story rather
 * than being decoration bolted on.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { uploadBuffer, publicUrlForKey } from "./storage";

const API = "https://api.x.ai/v1";
const MODEL = process.env.XAI_IMAGE_MODEL ?? "grok-imagine-image-quality";

export class ImagineError extends Error {}

export function imagineEnabled(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

/** Aspect ratios the API accepts, narrowed to the ones a book needs. */
export type Aspect = "2:3" | "3:2" | "1:1" | "16:9" | "4:3" | "3:4";

interface GenerateOptions {
  prompt: string;
  aspect?: Aspect;
  /** "2k" for covers, "1k" for in-chapter art. */
  resolution?: "1k" | "2k";
  /** Optional source image for an edit rather than a fresh generation. */
  sourceUrl?: string;
}

interface ImagineResponse {
  data?: { b64_json?: string; url?: string; mime_type?: string }[];
  usage?: { cost_in_usd_ticks?: number };
  error?: string | { message?: string };
}

/**
 * Ask for one image and return the raw bytes.
 *
 * Requests base64 rather than a URL deliberately: xAI's returned URLs are
 * temporary, so fetching them later is a race we'd sometimes lose. Taking the
 * bytes inline means the only copy that matters is the one we store.
 */
async function callImagine(opts: GenerateOptions): Promise<{ buffer: Buffer; costTicks: number }> {
  if (!imagineEnabled()) {
    throw new ImagineError("Image generation isn't configured — XAI_API_KEY is missing.");
  }

  const editing = Boolean(opts.sourceUrl);
  const body: Record<string, unknown> = {
    model: MODEL,
    prompt: opts.prompt,
    response_format: "b64_json",
    resolution: opts.resolution ?? "1k",
  };
  if (opts.aspect) body.aspect_ratio = opts.aspect;
  if (editing) body.image = { url: opts.sourceUrl, type: "image_url" };

  const res = await fetch(`${API}/images/${editing ? "edits" : "generations"}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as ImagineResponse;
  if (!res.ok) {
    const message =
      typeof json.error === "string" ? json.error : (json.error?.message ?? `HTTP ${res.status}`);
    throw new ImagineError(`The illustrator refused that request: ${message}`);
  }

  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new ImagineError("No image came back — try rewording the request.");

  return {
    buffer: Buffer.from(b64, "base64"),
    costTicks: json.usage?.cost_in_usd_ticks ?? 0,
  };
}

export interface StoredImage {
  url: string;
  /** What the request cost, in US cents. */
  costCents: number;
  width: number;
  height: number;
}

/** Generate, convert to a web-friendly format, and keep it permanently. */
async function generateAndStore(
  folder: string,
  opts: GenerateOptions
): Promise<StoredImage> {
  const { buffer, costTicks } = await callImagine(opts);

  // WebP at quality 88 keeps covers sharp while cutting a 2k PNG by ~80%.
  const image = sharp(buffer);
  const meta = await image.metadata();
  const webp = await image.webp({ quality: 88 }).toBuffer();

  const hash = createHash("sha256").update(webp).digest("hex").slice(0, 16);
  const key = `${folder}/${hash}.webp`;
  await uploadBuffer(key, webp, "image/webp");

  return {
    url: publicUrlForKey(key),
    // 1 cent = 100,000,000 ticks
    costCents: costTicks / 100_000_000,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}

export interface BookContext {
  title: string;
  subtitle?: string;
  authorName?: string;
  genre?: string;
  description?: string;
}

export interface CoverOptions {
  /** Anything specific the author asked for about the look. */
  direction?: string;
  /**
   * Paint the title into the artwork itself.
   *
   * Off by default because Lectoire typesets the title over the art, and two
   * titles on one cover looks like a mistake. On when the author explicitly
   * wants lettering that belongs to the picture.
   */
  includeTitle?: boolean;
  /** Overrides the book title for the lettering — long titles don't fit. */
  titleText?: string;
}

/**
 * A cover for this specific book.
 *
 * Two modes, and the difference matters. By default the image carries no words
 * at all, because the app draws the title over it and baked-in text would
 * collide. When the author wants the title as part of the artwork, we ask for it
 * explicitly and spell it out — image models garble text they have to guess at.
 */
export async function generateCover(
  book: BookContext,
  directionOrOptions?: string | CoverOptions
): Promise<StoredImage> {
  const opts: CoverOptions =
    typeof directionOrOptions === "string"
      ? { direction: directionOrOptions }
      : (directionOrOptions ?? {});

  const facts = [
    `Title: "${book.title}"`,
    book.subtitle && `Subtitle: "${book.subtitle}"`,
    book.genre && `Genre: ${book.genre}`,
    book.description && `What it's about: ${book.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lettering = opts.titleText?.trim() || book.title;
  const typography = opts.includeTitle
    ? `Render the title as part of the cover, spelled exactly:

${lettering}

Set it large and legible across the upper third, in a typeface that suits the
genre, with enough contrast against the art behind it to read at thumbnail size.
Every letter must be correct and cleanly formed — no invented words, no garbled
or doubled letters, no extra text of any kind beyond that title.`
    : `Absolutely no text, letters, words or numbers anywhere in the image — the
title and author name are typeset over this artwork afterwards.`;

  const prompt = `Design the artwork for a book cover.

${facts}
${opts.direction ? `\nThe author asks for: ${opts.direction}` : ""}

Make it look like a book someone would pick up in a shop: one strong central
image, deliberate composition, colours that suit the genre, and clear space in
the upper third. Rich and atmospheric rather than busy.

${typography}`;

  return generateAndStore("covers", { prompt, aspect: "2:3", resolution: "2k" });
}

/** A picture for a moment inside a chapter. */
export async function generateChapterImage(
  book: BookContext,
  subject: string,
  chapterTitle?: string
): Promise<StoredImage> {
  const prompt = `An illustration for a book.

Book: "${book.title}"${book.genre ? ` (${book.genre})` : ""}
${chapterTitle ? `Chapter: "${chapterTitle}"` : ""}
Scene to illustrate: ${subject}

Match the mood of the story. Composed like a plate in a printed book — a single
clear subject, readable at a glance, warm and inviting. No text or lettering
anywhere in the image.`;

  return generateAndStore("illustrations", { prompt, aspect: "3:2", resolution: "1k" });
}

/** Change an existing image without starting again. */
export async function editImage(sourceUrl: string, instruction: string): Promise<StoredImage> {
  return generateAndStore("illustrations", {
    prompt: instruction,
    sourceUrl,
    resolution: "1k",
  });
}

/**
 * Rework the cover the book already has.
 *
 * Keeps the existing artwork and changes only what was asked — the author has
 * usually just approved that picture, so regenerating from scratch would throw
 * away the thing they liked. Held at 2:3 and 2k so an edited cover is the same
 * shape and quality as a fresh one.
 */
export async function editCover(
  currentUrl: string,
  instruction: string,
  book?: BookContext
): Promise<StoredImage> {
  const context = book
    ? `\n\nThe book is "${book.title}"${book.subtitle ? ` — ${book.subtitle}` : ""}${book.genre ? `, a ${book.genre} book` : ""}.`
    : "";
  return generateAndStore("covers", {
    prompt: `${instruction}${context}\n\nKeep everything else about this cover exactly as it is — the same artwork, composition, characters and colours. Change only what was asked for.`,
    sourceUrl: currentUrl,
    aspect: "2:3",
    resolution: "2k",
  });
}

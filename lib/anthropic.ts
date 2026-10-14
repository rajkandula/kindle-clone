import Anthropic from "@anthropic-ai/sdk";

/** Overridable via env — e.g. BOOK_MODEL=claude-sonnet-5 for stronger prose. */
export const BOOK_MODEL = process.env.BOOK_MODEL ?? "claude-haiku-4-5-20251001";

/**
 * Illustrations get the strongest model, always.
 *
 * Drawing is far harder than prose: the model has to hold a whole composition
 * in its head and express it as coordinates, with no canvas to look at. A
 * chapter written by a fast model reads fine; a picture drawn by one comes out
 * as coloured blobs. This is the one place where model choice is visible to
 * the reader on sight, so it is not tied to BOOK_MODEL.
 */
export const ILLUSTRATION_MODEL = process.env.ILLUSTRATION_MODEL ?? "claude-opus-5";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and configure it."
    );
  }
  if (!client) client = new Anthropic();
  return client;
}

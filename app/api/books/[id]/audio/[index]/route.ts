import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book } from "@/lib/models";
import { canRead } from "@/lib/entitlement";
import {
  DEFAULT_VOICE,
  NARRATOR_VOICES,
  ensureChapterAudio,
  narrationEnabled,
  readNarration,
  type NarratorVoice,
} from "@/lib/audiobook";

export const maxDuration = 60;

async function authorizeBook(id: string) {
  const user = await getVerifiedUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!mongoose.isValidObjectId(id)) {
    return { error: NextResponse.json({ error: "Bad request" }, { status: 400 }) };
  }
  await connectDB();
  const book = await Book.findById(id);
  if (!book) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const isOwn = book.ownerId?.toString() === user.id;
  if (book.status !== "published" && !isOwn) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  // Exactly the reader's gate — narration must never be a way around it.
  if (!(await canRead(book, user))) {
    return {
      error: NextResponse.json({ error: "You don't have access to this book." }, { status: 403 }),
    };
  }
  return { book };
}

const voiceFrom = (v: unknown): NarratorVoice =>
  NARRATOR_VOICES.some((x) => x.id === v) ? (v as NarratorVoice) : DEFAULT_VOICE;

/** Narration status + audio URLs for a chapter. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const chapterIndex = parseInt(index, 10);
  if (!Number.isFinite(chapterIndex) || chapterIndex < 1) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const auth = await authorizeBook(id);
  if ("error" in auth) return auth.error;

  const voice = voiceFrom(new URL(req.url).searchParams.get("voice"));
  const manifest = await readNarration(id, chapterIndex, voice);
  if (!manifest) return NextResponse.json({ status: "none" });
  return NextResponse.json({
    ...manifest,
    generating: manifest.status === "preparing",
  });
}

/**
 * Start (or resume) narration for a chapter.
 *
 * Any reader who can open the chapter can start it. That used to be the
 * author's job alone, on the reasoning that a reader should never sit watching
 * a progress counter — but the service now emits a short opening part first,
 * so audio begins within seconds and the rest renders while it plays. Waiting
 * for an author to narrate every chapter of every book was the worse deal:
 * most chapters simply stayed silent.
 *
 * Access is still exactly the reader's gate — authorizeBook() applies the same
 * canRead() check as the reader itself, so narration is never a way around
 * paying for a book.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const chapterIndex = parseInt(index, 10);
  if (!Number.isFinite(chapterIndex) || chapterIndex < 1) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!narrationEnabled()) {
    return NextResponse.json({
      status: "unavailable",
      voice: DEFAULT_VOICE,
      parts: 0,
      totalParts: 0,
      urls: [],
      generating: false,
    });
  }
  const auth = await authorizeBook(id);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const manifest = await ensureChapterAudio(id, chapterIndex, voiceFrom(body?.voice));
  if (!manifest) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  return NextResponse.json({
    ...manifest,
    generating: manifest.status === "preparing",
  });
}

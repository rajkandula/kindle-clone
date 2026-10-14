/**
 * Chapter narration, produced by an external text-to-speech service
 * (Chanova Audio, configured with CHANOVA_AUDIO_URL and CHANOVA_AUDIO_KEY).
 * Leave either unset and narration is simply switched off.
 *
 * The contract this file relies on: `POST /v1/speech` with
 * `{ text, voice, cache_only? }` and `GET /v1/jobs/:id`, both answering
 * `{ id, status, parts, total_parts, audio_urls, duration_seconds, error? }`
 * behind a bearer key.
 *
 * Nothing is synthesized here: this app sends chapter text to the API and
 * stores the audio URLs it gets back. That keeps CPU-heavy speech work off
 * the web server entirely, and the service caches by text, so re-requesting
 * an unchanged chapter is free.
 *
 * Narration is keyed by a hash of the chapter text — edit a chapter and the
 * old audio is simply no longer matched, so stale narration is never served.
 */
import { createHash } from "node:crypto";
import type mongoose from "mongoose";
import { Book, Chapter, Narration } from "./models";

/** Mirrors the voices offered by the Chanova Audio service. */
export const NARRATOR_VOICES = [
  { id: "af_heart", label: "Heart — warm (US)" },
  { id: "af_bella", label: "Bella — expressive (US)" },
  { id: "af_nicole", label: "Nicole — soft (US)" },
  { id: "bf_emma", label: "Emma (UK)" },
  { id: "am_fenrir", label: "Fenrir (US, male)" },
] as const;
export type NarratorVoice = (typeof NARRATOR_VOICES)[number]["id"];
export const DEFAULT_VOICE: NarratorVoice = "af_heart";

export interface AudioManifest {
  status: "preparing" | "ready" | "error" | "unavailable";
  voice: string;
  parts: number;
  totalParts: number;
  urls: string[];
  error?: string;
}

const API_URL = () => (process.env.CHANOVA_AUDIO_URL ?? "").replace(/\/$/, "");
const API_KEY = () => process.env.CHANOVA_AUDIO_KEY ?? "";

/** Whether narration can be produced at all (service address and key present). */
export function narrationEnabled(): boolean {
  return Boolean(API_URL() && API_KEY());
}

/** Markdown → listenable prose (mirrors the reader's own cleanup). */
function markdownToSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*-]{3,}\s*$/gm, " ")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const hashText = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

interface ServiceJob {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  parts: number;
  total_parts: number;
  audio_urls: string[];
  duration_seconds: number;
  error?: string;
}

async function callService(path: string, init?: RequestInit): Promise<ServiceJob | null> {
  try {
    const res = await fetch(`${API_URL()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${API_KEY()}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      // The service sleeps between bursts and a cold wake is slow. Without a
      // bound, a reader's probe hangs on that wake instead of falling back to
      // "no audio yet" — so a chapter that HAD narration looked like it had none.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(`audio service ${path} → ${res.status}`, body?.error ?? "");
      return null;
    }
    return (await res.json()) as ServiceJob;
  } catch (err) {
    console.error(`audio service ${path} failed:`, err);
    return null;
  }
}

function toManifest(n: {
  status: string;
  voice: string;
  parts: number;
  totalParts: number;
  urls: string[];
  error?: string;
}): AudioManifest {
  return {
    status: n.status as AudioManifest["status"],
    voice: n.voice,
    parts: n.parts,
    totalParts: n.totalParts,
    urls: n.urls,
    ...(n.error ? { error: n.error } : {}),
  };
}

/** The spoken text for a chapter, plus its hash. */
async function chapterSpeech(
  bookId: mongoose.Types.ObjectId | string,
  index: number
): Promise<{ text: string; hash: string } | null> {
  const chapter = await Chapter.findOne({ bookId, index }).select("title content");
  if (!chapter) return null;
  const text = `${chapter.title}. ${markdownToSpeech(chapter.content)}`;
  return { text, hash: hashText(text) };
}

/** Refresh a still-rendering record from the service. */
async function syncJob(record: InstanceType<typeof Narration>): Promise<AudioManifest> {
  if (!record.jobId) return toManifest(record);
  const job = await callService(`/v1/jobs/${record.jobId}`);
  if (!job) return toManifest(record);

  record.parts = job.parts;
  record.totalParts = job.total_parts;
  record.urls = job.audio_urls;
  record.durationSeconds = job.duration_seconds;
  record.status =
    job.status === "done" ? "ready" : job.status === "error" ? "error" : "preparing";
  if (job.error) record.error = job.error;
  await record.save();
  return toManifest(record);
}

/** Current narration state for a chapter, without starting one. */
export async function readNarration(
  bookId: string,
  index: number,
  voice: string
): Promise<AudioManifest | null> {
  const speech = await chapterSpeech(bookId, index);
  if (!speech) return null;
  const record = await Narration.findOne({
    bookId,
    chapterIndex: index,
    textHash: speech.hash,
    voice,
  });
  if (record) {
    return record.status === "preparing" ? syncJob(record) : toManifest(record);
  }

  // No local record — but the service may already hold this audio, from a bulk
  // pre-render or from another copy of the same text. Ask (free, renders
  // nothing) so readers get studio narration that already exists.
  return adoptCached(bookId, index, voice, speech);
}

/**
 * Claim narration the service has already rendered.
 *
 * `cache_only` never starts a render and never spends credits: it answers
 * "do you have this?" and nothing more. A hit is recorded locally so later
 * reads skip the round trip entirely.
 */
async function adoptCached(
  bookId: string,
  index: number,
  voice: string,
  speech: { text: string; hash: string }
): Promise<AudioManifest | null> {
  if (!narrationEnabled()) return null;
  const job = await callService("/v1/speech", {
    method: "POST",
    body: JSON.stringify({ text: speech.text, voice, cache_only: true }),
  });
  if (!job || job.status !== "done" || !job.audio_urls?.length) return null;

  const record = await Narration.findOneAndUpdate(
    { bookId, chapterIndex: index, textHash: speech.hash, voice },
    {
      $set: {
        jobId: job.id,
        status: "ready",
        urls: job.audio_urls,
        parts: job.parts ?? job.audio_urls.length,
        totalParts: job.total_parts ?? job.audio_urls.length,
        durationSeconds: job.duration_seconds ?? 0,
        error: "",
      },
    },
    { upsert: true, new: true }
  );
  return toManifest(record);
}

/**
 * Ensure narration exists for a chapter, starting it if needed.
 * Returns immediately — long chapters render at the service and the reader
 * polls until the parts arrive.
 */
export async function ensureChapterAudio(
  bookId: mongoose.Types.ObjectId | string,
  index: number,
  voice: NarratorVoice = DEFAULT_VOICE
): Promise<AudioManifest | null> {
  const id = bookId.toString();
  if (!narrationEnabled()) {
    return { status: "unavailable", voice, parts: 0, totalParts: 0, urls: [] };
  }

  const speech = await chapterSpeech(id, index);
  if (!speech) return null;

  const existing = await Narration.findOne({
    bookId: id,
    chapterIndex: index,
    textHash: speech.hash,
    voice,
  });
  if (existing && existing.status !== "error") {
    return existing.status === "preparing" ? syncJob(existing) : toManifest(existing);
  }
  // A failed render shouldn't be permanent — clear it and ask again.
  if (existing) await existing.deleteOne();

  // Ask the service to narrate. Unchanged text it has seen before comes back
  // instantly and costs nothing.
  const job = await callService("/v1/speech", {
    method: "POST",
    body: JSON.stringify({ text: speech.text, voice }),
  });
  if (!job) {
    return { status: "error", voice, parts: 0, totalParts: 0, urls: [], error: "Narration service unavailable." };
  }

  const record = await Narration.findOneAndUpdate(
    { bookId: id, chapterIndex: index, textHash: speech.hash, voice },
    {
      $set: {
        jobId: job.id,
        status:
          job.status === "done" ? "ready" : job.status === "error" ? "error" : "preparing",
        urls: job.audio_urls ?? [],
        parts: job.parts ?? 0,
        totalParts: job.total_parts ?? 0,
        durationSeconds: job.duration_seconds ?? 0,
        error: job.error ?? "",
      },
    },
    { upsert: true, new: true }
  );

  // Old narrations of earlier versions of this chapter are dead weight
  Narration.deleteMany({
    bookId: id,
    chapterIndex: index,
    textHash: { $ne: speech.hash },
  }).catch(() => {});

  return toManifest(record);
}

/**
 * Narrate a whole book in the background — used when a book is published, so
 * its audio is being made before anyone opens it.
 *
 * Chapters are submitted a few at a time: the service queues the work, and
 * pacing the submissions keeps one large book from monopolising the queue
 * ahead of everyone else's.
 */
export async function narrateBook(
  bookId: mongoose.Types.ObjectId | string,
  voice: NarratorVoice = DEFAULT_VOICE
): Promise<void> {
  if (!narrationEnabled()) return;
  const id = bookId.toString();
  const chapters = await Chapter.find({ bookId: id }).sort({ index: 1 }).select("index");

  const CONCURRENT = 2;
  for (let i = 0; i < chapters.length; i += CONCURRENT) {
    await Promise.all(
      chapters
        .slice(i, i + CONCURRENT)
        .map((c) => ensureChapterAudio(id, c.index, voice).catch(() => null))
    );
  }
}

/**
 * Claim, for the whole published catalogue, any narration the service has
 * already rendered.
 *
 * The service and this database drifted apart: 223 chapters had finished audio
 * sitting in the service cache while the library showed them as un-narrated,
 * because a local record is only written when somebody happens to open the
 * chapter and the probe succeeds. One failed probe — a sleeping container, a
 * timeout — and the chapter looked silent forever.
 *
 * `cache_only` renders nothing and costs nothing, so this is safe to run on
 * every housekeeping tick. It is capped per sweep so a large catalogue is
 * picked up over several ticks rather than in one long request.
 */
export async function adoptCatalogueAudio(limit = 40): Promise<{
  missing: number;
  probed: number;
  adopted: number;
}> {
  if (!narrationEnabled()) return { missing: 0, probed: 0, adopted: 0 };

  const books = await Book.find({ status: "published" }).select("_id");
  const bookIds = books.map((b) => b._id);
  if (bookIds.length === 0) return { missing: 0, probed: 0, adopted: 0 };

  const [chapters, have] = await Promise.all([
    Chapter.find({ bookId: { $in: bookIds } }).select("bookId index"),
    Narration.find({ bookId: { $in: bookIds }, voice: DEFAULT_VOICE, status: "ready" }).select(
      "bookId chapterIndex"
    ),
  ]);

  const seen = new Set(have.map((n) => `${n.bookId.toString()}:${n.chapterIndex}`));
  const missing = chapters.filter((c) => !seen.has(`${c.bookId.toString()}:${c.index}`));

  let adopted = 0;
  for (const c of missing.slice(0, limit)) {
    // readNarration falls through to the free cache_only probe when no local
    // record exists, and writes one on a hit.
    const manifest = await readNarration(c.bookId.toString(), c.index, DEFAULT_VOICE).catch(
      () => null
    );
    if (manifest?.status === "ready") adopted++;
  }
  return { missing: missing.length, probed: Math.min(missing.length, limit), adopted };
}

/**
 * Restart narrations that died mid-render.
 *
 * The service resumes a stalled job only when something polls it, and readers
 * stopped polling when narration became author-controlled — so a render killed
 * by a container restart used to sit at "preparing" forever with no error and
 * nobody watching. This sweep is the thing that notices.
 */
export async function resumeStalledNarrations(olderThanMinutes = 15): Promise<{
  checked: number;
  resumed: number;
  failed: number;
}> {
  if (!narrationEnabled()) return { checked: 0, resumed: 0, failed: 0 };

  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stuck = await Narration.find({ status: "preparing", updatedAt: { $lt: cutoff } })
    .sort({ updatedAt: 1 })
    .limit(40);

  let resumed = 0;
  let failed = 0;
  for (const record of stuck) {
    const manifest = await syncJob(record);
    if (manifest.status === "ready") {
      resumed++;
      continue;
    }
    if (manifest.status === "error") {
      failed++;
      continue;
    }
    // Still "preparing" long after the service should have finished: the job is
    // gone. Drop the record so the chapter can be narrated again.
    //
    // Measured from createdAt, never updatedAt — syncJob writes to the record
    // each sweep, so an updatedAt cutoff resets its own clock and a genuinely
    // dead render is re-checked forever instead of being cleared.
    if (record.createdAt < new Date(Date.now() - 60 * 60_000)) {
      await record.deleteOne();
      failed++;
    }
  }
  return { checked: stuck.length, resumed, failed };
}

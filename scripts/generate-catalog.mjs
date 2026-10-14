/**
 * Generates the Lectoire store catalog with REAL AI-written books.
 *
 * For each spec: Claude designs the book (title, blurb, outline), then writes
 * every chapter in order, with the running outline + previous chapter ending
 * passed back in for continuity. Books are published under the honest byline
 * "Lectoire Originals" — no invented human authors.
 *
 * Usage: npm run generate:catalog
 * Re-runnable: replaces only catalog books (ownerId: null), never user books.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";

/* ---------- env ---------- */
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* rely on real env */
  }
}
loadEnv();
if (!process.env.MONGODB_URI || !process.env.ANTHROPIC_API_KEY) {
  console.error("MONGODB_URI and ANTHROPIC_API_KEY are required — configure .env.local.");
  process.exit(1);
}

const MODEL = process.env.BOOK_MODEL ?? "claude-haiku-4-5-20251001";
const AUTHOR = "Lectoire Originals";
const anthropic = new Anthropic();

/* ---------- what to write (premises only — Claude invents everything else) ---------- */
const SPECS = [
  { genre: "Fiction", premise: "During a citywide blackout, a late-night radio host keeps broadcasting by generator, and the calls that come in over one long dark night quietly change every caller — and her.", flags: { bestseller: true, featured: true } },
  { genre: "Thriller", premise: "A fire lookout spending her first season alone on a remote tower spots a signal fire on a far ridge — arranged in a pattern only her missing brother would know.", flags: { bestseller: true } },
  { genre: "Mystery", premise: "A crossword setter discovers someone is solving the private messages she hides in her puzzles — and leaving answers that predict small crimes before they happen.", flags: { free: true } },
  { genre: "Sci-Fi", premise: "The last courier on the interstellar mail run delivers Earth's final letters to the colonies — including one addressed to a person who was born years after Earth went silent.", flags: { featured: true } },
  { genre: "Fantasy", premise: "A young cartographer realizes the maps she draws don't record the land — they revise it, and someone is paying dearly for her to redraw a border that erased a village.", flags: { bestseller: true } },
  { genre: "Romance", premise: "A rare-books appraiser is sent to value — and close — a failing seaside bookshop, and begins trading handwritten notes with its owner in the margins of the same battered novel.", flags: {} },
  { genre: "Horror", premise: "An audio archivist restoring century-old wax-cylinder recordings hears, beneath the hiss, a voice that addresses her by name and asks her — politely, then less politely — to stop.", flags: {} },
  { genre: "Adventure", premise: "A retired mountain guide returns for one final climb: recovering his lost friend's journal from a glacier that is melting fast enough to give up its dead.", flags: { featured: true } },
  { genre: "History", premise: "Narrative history of the race to lay the first transatlantic telegraph cable — the engineers, sailors, and gamblers who tried to sew two continents together with a wire.", flags: {} },
  { genre: "Biography", premise: "The life of a fictional lighthouse keeper told through the sixty years of logbooks she left behind — storms, shipwrecks, a war, and the one entry she wrote in someone else's hand.", flags: {} },
  { genre: "Poetry", premise: "A poetry collection tracing one year in a small city garden, season by season — soil, weather, neighbours, patience, and what returns after winter.", flags: { free: true } },
  { genre: "Business", premise: "A practical field guide to building a calm one-person business — pricing, boundaries, first customers, and staying small on purpose. Concrete, honest, zero hustle-culture.", flags: { bestseller: true } },
  { genre: "Self-Help", premise: "A warm, evidence-minded guide to having better conversations — listening well, disagreeing kindly, repairing awkward moments, and being someone people love talking to.", flags: {} },
  { genre: "Children", premise: "A small mouse who lives in a lighthouse borrows a little of the moon's light each night to help lost boats find home — until one cloudy night the moon needs help instead. Gentle bedtime story.", flags: { featured: true, free: true } },
];
const CHAPTERS_PER_BOOK = 5;

/* ---------- cover style (mirrors lib/covers.ts) ---------- */
const PALETTE_COUNT = 12;
const LAYOUT_COUNT = 4;
const GENRE_PALETTES = {
  Thriller: [0, 7, 9], Mystery: [0, 7, 3], Horror: [7, 4, 1], Romance: [4, 11, 6],
  "Sci-Fi": [9, 5, 3], Fantasy: [3, 0, 8], History: [10, 6, 7], Biography: [6, 10, 9],
  Business: [9, 6, 0], "Self-Help": [11, 2, 6], Poetry: [6, 8, 3], Adventure: [2, 5, 1],
  Children: [11, 2, 5], Fiction: [8, 1, 10],
};
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
function coverStyleFor(title, genre) {
  const h = hashString(title + "::" + genre);
  const pool = GENRE_PALETTES[genre] ?? [h % PALETTE_COUNT];
  return { palette: pool[h % pool.length], layout: (h >>> 3) % LAYOUT_COUNT };
}
const words = (t) => t.split(/\s+/).filter(Boolean).length;

/** Strip redundant "Chapter One" / repeated-title openings — the reader renders its own header. */
function cleanChapterContent(content, title) {
  const lines = content.split("\n");
  let i = 0;
  const strip = (line) =>
    line.replace(/^#{1,4}\s*/, "").replace(/^\*\*(.*)\*\*$/, "$1").replace(/[.:—-]+$/, "").trim();
  const chapterRx = /^chapter\s+(?:[a-z]+(?:[- ][a-z]+)?|\d+)$/i;
  while (i < lines.length) {
    const s = strip(lines[i]);
    if (s === "" && i < 4) { i++; continue; }
    if (chapterRx.test(s) || s.toLowerCase() === title.trim().toLowerCase()) { i++; continue; }
    break;
  }
  return lines.slice(i).join("\n").trimStart();
}

/* ---------- generation ---------- */
async function ask(system, user, maxTokens) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const DESIGN_SYSTEM = `You are the staff writer for Lectoire Originals, the in-house imprint of the Lectoire book platform. You design and write complete, publishable short books. You respond ONLY with what is asked — no preamble.`;

async function designBook(spec) {
  const prompt = `Design a ${spec.genre} book from this premise:

"${spec.premise}"

Return ONLY a JSON object (no markdown fences) with exactly these fields:
{
  "title": "evocative title, max 6 words, no colon unless essential",
  "subtitle": "optional subtitle or empty string",
  "description": "back-cover blurb, 2-4 sentences, no spoilers, no marketing clichés",
  "tags": ["4-6 short lowercase discovery tags"],
  "chapters": [ { "title": "chapter title without numbering", "summary": "2-3 sentences of what happens / what it covers" } ]
}
Exactly ${CHAPTERS_PER_BOOK} chapters. The chapter arc must feel complete — a real beginning, middle, and earned ending.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await ask(DESIGN_SYSTEM, prompt, 3000);
    try {
      const plan = parseJson(text);
      if (plan.title && Array.isArray(plan.chapters) && plan.chapters.length > 0) return plan;
    } catch {
      /* retry once */
    }
  }
  throw new Error(`Could not design book for premise: ${spec.premise.slice(0, 50)}…`);
}

async function writeChapter(spec, plan, index, previousEnding) {
  const ch = plan.chapters[index];
  const outline = plan.chapters
    .map((c, i) => `${i + 1}. ${c.title} — ${c.summary}`)
    .join("\n");
  const continuity =
    index === 0
      ? "This is the opening chapter."
      : `The previous chapter ended with:\n"…${previousEnding}"\nContinue seamlessly — same names, facts, threads, and voice.`;

  const prompt = `Book: "${plan.title}" (${spec.genre})
Premise: ${spec.premise}
Full outline:
${outline}

Write CHAPTER ${index + 1}: "${ch.title}".
Planned content: ${ch.summary}

${continuity}

Requirements:
- ${spec.genre === "Poetry" ? "Write 5-8 finished poems for this section (600-1000 words total), each with its own ### title. Varied forms and line lengths — no prose." : "900-1400 words of finished, publishable prose in Markdown."}
- Do NOT repeat the chapter title or number in the text.
- Use *** on its own line for scene breaks (fiction) or clear ## subheadings (non-fiction).
- Vivid and concrete; vary sentence rhythm; show, don't summarize.
- ${spec.genre === "Children" ? "Read-aloud rhythm, warm, simple vocabulary, gentle repetition." : spec.genre === "Self-Help" || spec.genre === "Business" ? "Warm, practical, concrete examples and directly usable advice — zero filler." : spec.genre === "Poetry" ? "Concrete images over abstractions; every poem earns its ending." : "Land the chapter on a line that pulls the reader forward."}
- Output ONLY the chapter prose.`;

  return (await ask(DESIGN_SYSTEM, prompt, 6000)).trim();
}

async function generateBook(spec, order, log) {
  log(`designing…`);
  const plan = await designBook(spec);
  log(`“${plan.title}” — writing ${plan.chapters.length} chapters`);

  const chapters = [];
  let previousEnding = "";
  for (let i = 0; i < plan.chapters.length; i++) {
    const raw = await writeChapter(spec, plan, i, previousEnding);
    const content = cleanChapterContent(raw, plan.chapters[i].title);
    previousEnding = content.slice(-600).replace(/\s+/g, " ").trim();
    chapters.push({ title: plan.chapters[i].title, content });
    log(`  ch ${i + 1}/${plan.chapters.length} ✓ (${words(content)}w)`);
  }
  return { spec, plan, chapters, order };
}

/* ---------- main ---------- */
async function main() {
  const started = Date.now();
  console.log(`Model: ${MODEL} — generating ${SPECS.length} books × ${CHAPTERS_PER_BOOK} chapters\n`);

  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  const db = mongoose.connection.db;
  const booksCol = db.collection("books");
  const chaptersCol = db.collection("chapters");

  // Generate with limited concurrency (3 books in flight)
  const results = [];
  let cursor = 0;
  async function worker(id) {
    while (cursor < SPECS.length) {
      const idx = cursor++;
      const spec = SPECS[idx];
      const tag = `[${spec.genre}]`;
      try {
        const book = await generateBook(spec, idx, (m) => console.log(`${tag} ${m}`));
        results.push(book);
      } catch (err) {
        console.error(`${tag} FAILED: ${err.message}`);
      }
    }
  }
  await Promise.all([worker(1), worker(2), worker(3)]);

  if (results.length === 0) throw new Error("No books were generated.");

  // Only replace the old catalog once new content is safely in hand
  const old = await booksCol.find({ ownerId: null }).project({ _id: 1 }).toArray();
  if (old.length) {
    await chaptersCol.deleteMany({ bookId: { $in: old.map((b) => b._id) } });
    await booksCol.deleteMany({ _id: { $in: old.map((b) => b._id) } });
    console.log(`\nCleared ${old.length} old catalog books.`);
  }

  const now = Date.now();
  for (const { spec, plan, chapters, order } of results.sort((a, b) => a.order - b.order)) {
    const wordCount = chapters.reduce((s, c) => s + words(c.content), 0);
    const publishedAt = new Date(now - order * 86400000 * 2);
    const doc = {
      ownerId: null,
      title: plan.title,
      subtitle: plan.subtitle ?? "",
      authorName: AUTHOR,
      description: plan.description ?? "",
      genre: spec.genre,
      tags: (plan.tags ?? []).slice(0, 8),
      status: "published",
      coverUrl: "",
      coverStyle: coverStyleFor(plan.title, spec.genre),
      flags: { bestseller: false, free: false, featured: false, ...spec.flags },
      chapterCount: chapters.length,
      wordCount,
      publishedAt,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    };
    const { insertedId } = await booksCol.insertOne(doc);
    await chaptersCol.insertMany(
      chapters.map((c, i) => ({
        bookId: insertedId,
        index: i + 1,
        title: c.title,
        content: c.content,
        wordCount: words(c.content),
        createdAt: publishedAt,
        updatedAt: publishedAt,
      }))
    );
    console.log(`✓ ${plan.title} (${spec.genre}, ${chapters.length} ch, ${wordCount.toLocaleString()}w)`);
  }

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\nDone: ${results.length} books in ${mins} min.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

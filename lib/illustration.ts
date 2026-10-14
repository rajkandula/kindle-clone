/**
 * Illustrations drawn by the Studio.
 *
 * The AI writes SVG, which is just text — no image model, no extra service.
 * That makes it cheap, but it also means the drawing is untrusted input: SVG
 * can carry <script>, event handlers and external references, so a book could
 * otherwise run code in every reader's browser. Two defences, both applied:
 *
 *   1. Everything executable is stripped here, before the file is stored.
 *   2. The reader loads it via <img src>, which never executes scripts.
 *
 * A PNG is rendered alongside it because PDF and DOCX exports can't take SVG.
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { uploadBuffer, publicUrlForKey } from "./storage";
import { getAnthropic, ILLUSTRATION_MODEL } from "./anthropic";
import { Book, Chapter, IllustrationJob } from "./models";
import { generateChapterImage, imagineEnabled } from "./imagine";

/** Elements that can execute or fetch. Removed outright, contents and all. */
const BANNED_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "embed",
  "object",
  "use",
  "animate",
  "animateTransform",
  "set",
  "handler",
  "listener",
];

export class IllustrationError extends Error {}

/**
 * Strip everything executable from AI-written SVG.
 *
 * Deliberately a whitelist-ish scrub rather than a parser: the input is one
 * model-authored drawing, not arbitrary user HTML, and the dangerous surface
 * is small and well known.
 */
export function sanitizeSvg(raw: string): string {
  let svg = raw.trim();

  // Take only the <svg> element, ignoring any chatter around it
  const open = svg.indexOf("<svg");
  const close = svg.lastIndexOf("</svg>");
  if (open === -1 || close === -1) {
    throw new IllustrationError("That drawing didn't come back as valid SVG.");
  }
  svg = svg.slice(open, close + 6);

  for (const tag of BANNED_TAGS) {
    svg = svg.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"), "");
    svg = svg.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), "");
  }

  // on*= handlers, in quoted and bare forms
  svg = svg.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // javascript: and data: URLs, and any reference off to another origin
  svg = svg.replace(/(href|xlink:href|src)\s*=\s*"(?!#)[^"]*"/gi, "");
  svg = svg.replace(/(href|xlink:href|src)\s*=\s*'(?!#)[^']*'/gi, "");
  svg = svg.replace(/url\(\s*['"]?\s*(?:https?:|data:|javascript:)[^)]*\)/gi, "none");
  svg = svg.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "");
  svg = svg.replace(/<!--[\s\S]*?-->/g, "");

  if (!/^<svg[\s>]/i.test(svg)) {
    throw new IllustrationError("That drawing didn't come back as valid SVG.");
  }
  if (svg.length > 400_000) {
    throw new IllustrationError("That drawing is too large to store.");
  }
  return svg;
}

export interface StoredIllustration {
  svgUrl: string;
  pngUrl: string;
  markdown: string;
}

/**
 * Sanitise, render and store one illustration.
 * Returns the Markdown to drop into the chapter.
 */
export async function storeIllustration(
  bookId: string,
  rawSvg: string,
  alt: string
): Promise<StoredIllustration> {
  const svg = sanitizeSvg(rawSvg);
  const buf = Buffer.from(svg, "utf8");
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const base = `illustrations/${bookId}/${hash}`;

  // PDF and DOCX can't embed SVG, so keep a raster twin from the start.
  let png: Buffer;
  try {
    png = await sharp(buf, { density: 300 })
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
  } catch {
    throw new IllustrationError("That drawing couldn't be rendered as an image.");
  }

  await Promise.all([
    uploadBuffer(`${base}.svg`, buf, "image/svg+xml"),
    uploadBuffer(`${base}.png`, png, "image/png"),
  ]);

  const svgUrl = publicUrlForKey(`${base}.svg`);
  const cleanAlt = alt.replace(/[[\]]/g, "").trim() || "Illustration";
  return {
    svgUrl,
    pngUrl: publicUrlForKey(`${base}.png`),
    markdown: `\n\n![${cleanAlt}](${svgUrl})\n\n`,
  };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

/**
 * What separates a drawing from coloured blobs.
 *
 * The failure mode this exists to prevent: an "elephant" that is a grey
 * ellipse with four grey rectangles, a "giraffe" that is a tall rectangle with
 * a circle on top. Those are placeholders, not pictures. Children learn what an
 * animal looks like from these, so the silhouette has to be true.
 */
const ILLUSTRATION_SYSTEM = `You are an illustrator drawing in SVG for a printed book. You draw, you do not explain.

Return ONE complete <svg>…</svg> and nothing else. No markdown fence, no commentary.

## Canvas
- viewBox="0 0 800 600", width="100%".
- Flat vector colour. No photorealism, no gradients unless a single soft sky wash.
- No <text> anywhere. No scripts, no external images, no fonts.

## What makes a drawing read as the thing it is
1. **Silhouette first.** An animal is recognised by its outline before any detail. If the shape were filled solid black, could a five-year-old still name it? If not, redraw it.
2. **Lead with the species-defining feature, and exaggerate it.** Elephant: long curving trunk, huge fanned ears, tusks, column legs. Giraffe: neck longer than the body, ossicones, angular patches, sloping back. Lion: full mane framing the face. Zebra: bold irregular stripes that wrap the body. Penguin: upright teardrop, flippers, orange feet, white front bib. Bird: distinct beak shape, layered wing, tail fan. A generic quadruped body with a different colour is not a different animal.
3. **Proportion carries meaning.** Draw a real construction: head, neck, chest, hindquarters, legs with joints. Legs bend — knees and hocks, not straight rectangles. Necks meet bodies at an angle, not on top of them.
4. **Build from overlapping organic shapes**, back-to-front, using <path> with curves. Rectangles for limbs are a tell that you have stopped drawing.
5. **Outline everything.** A consistent dark-brown or charcoal stroke (3–5px, round caps and joins) around body shapes reads as illustration rather than clip-art. Never pure #000 for outlines — use #2b2118 or similar.
6. **Faces make it alive.** Eyes need a dark iris plus a small white highlight dot. Add a mouth line, nostril, brow, or cheek blush. A dot for an eye reads as dead.
7. **Ground the subject.** A soft ellipse shadow under the feet, and a horizon or ground band, so it stands in a place instead of floating.
8. **Layer depth**: sky, distant hills, mid-ground, subject, foreground detail. Subjects nearer the viewer sit lower and larger.
9. **Warm, saturated but not neon palette.** 5–8 colours, reused across the picture so it feels of one hand.

## Composition
Fill the frame. The subject should occupy roughly half to two-thirds of the canvas, not sit small in a corner. Leave calm space where a caption might go.

## Before you finish
Re-read your shapes and ask: does the outline alone identify this animal, do the legs bend, does the face have life, is it standing on something? Fix what fails, then output only the SVG.`;

export interface DrawRequest {
  subject: string;
  /** Book context so the art matches the writing, e.g. "children's picture book". */
  context?: string;
}

/**
 * Draw one illustration with the strongest model, in its own request.
 *
 * Deliberately separate from the Studio chat turn: a model juggling
 * conversation, prose and tool calls draws badly, and the SVG would eat the
 * chat's token budget. Here the model does one thing.
 */
export async function drawSvg({ subject, context }: DrawRequest): Promise<string> {
  const anthropic = getAnthropic();
  const brief = context
    ? `Draw: ${subject}\n\nThis illustration appears in: ${context}. Match that tone.`
    : `Draw: ${subject}`;

  const stream = anthropic.messages.stream({
    model: ILLUSTRATION_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: ILLUSTRATION_SYSTEM,
    messages: [{ role: "user", content: brief }],
  });

  const message = await stream.finalMessage();
  const svg = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!svg.includes("<svg")) {
    throw new IllustrationError("The illustrator didn't return a drawing — try again.");
  }
  return svg;
}

/**
 * Draw a queued illustration and place it in its chapter.
 *
 * Runs detached from the Studio turn because a drawing takes a couple of
 * minutes — long enough that doing it inline makes the chat look frozen, and
 * far too long to repeat twenty times for an illustrated book.
 */
export async function runIllustrationJob(jobId: string): Promise<void> {
  const job = await IllustrationJob.findById(jobId);
  if (!job || job.status !== "pending") return;

  job.attempts += 1;
  await job.save();

  try {
    const book = await Book.findById(job.bookId).select("title subtitle authorName genre description");
    if (!book) throw new IllustrationError("That book no longer exists.");
    const chapter = await Chapter.findOne({ bookId: job.bookId, index: job.chapterIndex });
    if (!chapter) throw new IllustrationError("That chapter no longer exists.");

    // Real artwork where it's available; the SVG illustrator is the fallback so
    // a deployment without an image key still draws something rather than
    // failing outright.
    let markdown: string;
    if (imagineEnabled()) {
      const art = await generateChapterImage(
        {
          title: book.title,
          subtitle: book.subtitle,
          genre: book.genre,
          description: book.description,
        },
        job.subject,
        chapter.title
      );
      const cleanAlt = job.alt.replace(/[[\]]/g, "").trim() || "Illustration";
      markdown = `\n\n![${cleanAlt}](${art.url})\n\n`;
    } else {
      const svg = await drawSvg({
        subject: job.subject,
        context: `${book.genre || "a"} book titled “${book.title}”`,
      });
      markdown = (await storeIllustration(job.bookId.toString(), svg, job.alt)).markdown;
    }

    chapter.content =
      job.placement === "top"
        ? `${markdown.trimStart()}\n${chapter.content}`
        : `${chapter.content}${markdown}`;
    await chapter.save();

    job.status = "done";
    await job.save();
  } catch (err) {
    job.status = job.attempts >= 3 ? "error" : "pending";
    job.error = err instanceof Error ? err.message : "The illustration failed.";
    await job.save();
  }
}

/** Pick up drawings orphaned by a restart. */
export async function resumeIllustrationJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  const stuck = await IllustrationJob.find({
    status: "pending",
    attempts: { $lt: 3 },
    updatedAt: { $lt: cutoff },
  }).limit(5);
  for (const job of stuck) await runIllustrationJob(job._id.toString());
  return stuck.length;
}

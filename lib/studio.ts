import type Anthropic from "@anthropic-ai/sdk";
import mongoose from "mongoose";
import { Book, Chapter, countWords, GENRES, IllustrationJob, type IBook } from "./models";
import { COVER_PALETTES, COVER_LAYOUT_COUNT, coverStyleFor } from "./covers";
import { runIllustrationJob } from "./illustration";
import { editCover, generateCover, imagineEnabled, ImagineError } from "./imagine";

/* ------------------------------------------------------------------ */
/* Tools the writing agent can call                                    */
/* ------------------------------------------------------------------ */

export const STUDIO_TOOLS: Anthropic.Tool[] = [
  {
    name: "set_book",
    description:
      "Update the book's metadata: title, subtitle, description (back-cover blurb), genre, tags, and cover style. Call this early once you and the author settle on a direction, and again whenever the direction changes.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The book title." },
        subtitle: { type: "string", description: "Optional subtitle or tagline." },
        author_name: {
          type: "string",
          description:
            "The author byline shown on the cover and in the store. Set this when the author asks to change the name on the cover.",
        },
        description: {
          type: "string",
          description: "Back-cover blurb, 2-4 sentences, no spoilers.",
        },
        genre: {
          type: "string",
          enum: [...GENRES],
          description: "Primary genre.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "3-6 short discovery tags.",
        },
        cover_palette: {
          type: "integer",
          description: `Cover palette index 0-${COVER_PALETTES.length - 1} (0 midnight&gold, 1 ember, 2 forest, 3 violet, 4 crimson, 5 deep-sea, 6 parchment, 7 ink&brass, 8 sage, 9 slate-sky, 10 leather, 11 terracotta). Omit to keep an auto pick.`,
        },
        cover_layout: {
          type: "integer",
          description: `Cover layout variant 0-${COVER_LAYOUT_COUNT - 1}. Omit to keep an auto pick.`,
        },
      },
    },
  },
  {
    name: "write_chapter",
    description:
      "Write a chapter of the book at a given position (1-based). If a chapter already exists at that position its text is REPLACED; otherwise the chapter is inserted there. Write complete, polished prose in Markdown — this is the final book text the reader sees, not an outline. Aim for the length the author asked for (default 800-1500 words).",
    input_schema: {
      type: "object",
      properties: {
        position: {
          type: "integer",
          description: "1-based chapter position. Use chapter_count+1 to append.",
        },
        title: { type: "string", description: "Chapter title (without a number)." },
        content: {
          type: "string",
          description:
            "Full chapter text in Markdown. Prose paragraphs; use *** for scene breaks. Do NOT repeat the chapter title inside the content.",
        },
      },
      required: ["position", "title", "content"],
    },
  },
  {
    name: "edit_chapter",
    description:
      "Change an existing chapter's title and/or replace its full text. Use read_chapter first if you need the current text.",
    input_schema: {
      type: "object",
      properties: {
        position: { type: "integer", description: "1-based chapter position." },
        title: { type: "string", description: "New title (omit to keep)." },
        content: {
          type: "string",
          description: "New full Markdown text (omit to keep).",
        },
      },
      required: ["position"],
    },
  },
  {
    name: "delete_chapter",
    description: "Remove a chapter. Later chapters shift up to close the gap.",
    input_schema: {
      type: "object",
      properties: {
        position: { type: "integer", description: "1-based chapter position." },
      },
      required: ["position"],
    },
  },
  {
    name: "generate_cover",
    description:
      "Create the book's cover artwork. The cover artist already reads the book's title, genre and blurb — you don't need to describe the picture. Pass `direction` to carry a specific wish (\"make it darker\", \"show the lighthouse\", \"watercolour\"). Set `include_title` to true whenever the author wants the title written ON the image itself — \"cover with the title on it\", \"put the name on the cover\". Replaces the current cover, so ask first unless they've just asked for it.",
    input_schema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          description:
            "Optional. Anything specific the author asked for about the look of the cover.",
        },
        include_title: {
          type: "boolean",
          description:
            "True to paint the title into the artwork. Default false, because Lectoire typesets the title over the cover already — two titles looks like a mistake. Set true only when the author asks for lettering in the image.",
        },
        title_text: {
          type: "string",
          description:
            "Optional shorter wording to letter onto the cover when include_title is true. Long titles render badly; a main title without the subtitle usually reads better.",
        },
      },
    },
  },
  {
    name: "edit_cover",
    description:
      "Change the cover the book already has, keeping the existing artwork. Use this whenever the author wants the current cover altered rather than replaced — adding the title into the picture, changing a colour, removing something, adjusting the mood. Say plainly what should change; the rest of the image is preserved. Only works when the book already has generated or uploaded cover art.",
    input_schema: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description:
            "What to change, in plain words — e.g. 'Add the title \"Amazing Animals\" across the top in a warm, friendly, rounded font that suits a children\'s book' or 'Make the sky darker and more dramatic'.",
        },
      },
      required: ["instruction"],
    },
  },
  {
    name: "generate_chapter_image",
    description:
      "Create an illustration for a moment in a chapter and place it there. Describe the scene concretely — what is happening, who or what is in it, the setting and the mood. Suits children's books, travel and cookery, memoirs, and any book where a picture earns its place. ALWAYS ask the author before calling this: it costs real money.",
    input_schema: {
      type: "object",
      properties: {
        position: { type: "integer", description: "1-based chapter position." },
        subject: {
          type: "string",
          description:
            "The scene to illustrate, concretely — e.g. 'a small grey mouse standing at the top of a lighthouse staircase at night, looking out at a storm over the sea' rather than 'the mouse'.",
        },
        alt: { type: "string", description: "Short description for readers using a screen reader." },
        placement: {
          type: "string",
          enum: ["top", "bottom"],
          description: "Start or end of the chapter. Defaults to the end.",
        },
      },
      required: ["position", "subject", "alt"],
    },
  },
  {
    name: "read_chapter",
    description:
      "Read back the current full text of a chapter (your context only shows titles and word counts). Use before revising.",
    input_schema: {
      type: "object",
      properties: {
        position: { type: "integer", description: "1-based chapter position." },
      },
      required: ["position"],
    },
  },
];

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

export interface ChapterMeta {
  index: number;
  title: string;
  wordCount: number;
}

export function buildSystemPrompt(book: IBook, chapters: ChapterMeta[]): string {
  const chapterList =
    chapters.length === 0
      ? "(no chapters yet)"
      : chapters
          .map((c) => `  ${c.index}. "${c.title}" — ${c.wordCount} words`)
          .join("\n");

  return `You are Lectoire's Studio — an expert book-writing partner inside Lectoire, a book platform. You collaborate with the author in chat AND you hold the pen: your tools write real chapters into their book, which they see updating live beside this conversation and can read in Lectoire's reader or publish to the store.

<current_book>
Title: ${book.title || "(untitled)"}
Subtitle: ${book.subtitle || "(none)"}
Author byline: ${book.authorName || "(none)"}
Genre: ${book.genre}
Description: ${book.description || "(none)"}
Chapters (${chapters.length}):
${chapterList}
</current_book>

How to work:
- FIRST MESSAGE of a project: briefly reflect the author's idea back, propose a title + a short chapter plan in chat, then call set_book, and write chapter 1 with write_chapter unless they only asked to brainstorm. Bias toward producing pages, not plans.
- When the author says "continue", "next chapter", or similar — just write it. Don't re-ask questions you already have answers to.
- Chapter prose goes in write_chapter/edit_chapter ONLY. Never paste full chapter text into the chat; in chat, give a 1-2 sentence note on what you wrote and where you could go next.
- Quality bar: vivid, concrete, publishable prose. Vary sentence rhythm. Show, don't summarize. Continuity matters — reuse names, facts, and threads from the chapter list and conversation; use read_chapter when unsure what an earlier chapter said.
- Respect the author's voice: if they provide text, preserve their style when editing. If they ask for changes, change exactly what they asked.
- Non-fiction is welcome too: structure with clear headings inside chapters, real explanations, no filler.
- Covers: every book starts with a typeset cover built from the title, byline, genre and palette — set_book restyles it (author_name, cover_palette, cover_layout). generate_cover replaces that with real painted artwork drawn from the book's own concept. edit_cover changes artwork that already exists, keeping it and altering only what was asked — use it for "add the title to the image", "make it warmer", "lose the butterfly". Reach for edit_cover before regenerating; a fresh cover throws away the one they just approved.
- Title ON the cover: if there is already artwork they like, use edit_cover to letter the title onto it. If there is no cover yet, call generate_cover with include_title true. Either way the request is "put the title on the image" — never answer that you cannot.
- Pictures: generate_chapter_image illustrates a moment inside a chapter. Offer it where a picture genuinely earns its place — children's books above all, but also travel, cookery, memoir, nature and how-to writing. Don't offer it for an adult novel unless the author raises it; illustrated literary fiction is unusual and the suggestion reads as noise.
- WHEN THE AUTHOR ASKS FOR SOMETHING CLEARLY, DO IT. "Generate a cover", "add the title to the image", "draw the lighthouse for chapter one" are instructions, not topics for discussion. Call the tool. Asking permission for the thing they just asked for is the single most irritating way to fail them.
- Propose first ONLY when you are raising an image they did not ask for, or when the request is genuinely too vague to act on ("add some pictures" to a ten-chapter book). Even then, propose once, then act on the answer.
- NEVER ASK THE SAME QUESTION TWICE. If they repeat or rephrase a request, that is confirmation — do it immediately. If you already asked and they replied, act; do not seek a second blessing.
- Before telling the author you cannot do something, check your tools. edit_cover changes an existing cover — including adding title text into the artwork. Saying "I can't" when a tool exists is a serious failure.
- Only ask when you truly cannot proceed: something ambiguous that changes the result, or a missing detail you cannot infer from the book. If you can make a sensible choice from what you already know, make it and say what you chose.
- You know this book better than they can hold in their head: its arc, its recurring images, what each chapter does. Use that. A good proposal names a real moment from the text and says why that one earns a picture — not "a nice illustration for chapter 3".
- If they push back on a result, use edit_cover to change what they named rather than starting over — they usually liked most of it.
- One unprompted suggestion at a time. If they decline, drop it and don't raise it again for that chapter.
- Images take a minute or two and appear on their own. Say so, and carry on writing rather than waiting.
- Attached documents: a user message may end with "[Attached document: name]" followed by its full text — that's source material the author uploaded (notes, a manuscript, research). Mine it faithfully: keep their facts, structure, and voice, and turn it into polished chapters. Don't echo the raw document back in chat.
- Keep chat replies short and warm — the book is the deliverable.

You can see the whole book — its title, genre, blurb, every chapter title and length, and you can read any chapter. Use that context when you suggest artwork: a cover should come from what the book is actually about, and an illustration should show a moment that really happens in that chapter. Never invent a scene the book doesn't contain.`;
}

/* ------------------------------------------------------------------ */
/* Tool execution                                                      */
/* ------------------------------------------------------------------ */

export interface ToolOutcome {
  /** Sent back to the model as the tool result. */
  result: string;
  /** Human-readable feed entry, e.g. "Wrote Chapter 3 — The Long Way Home". */
  label: string;
  /** Whether the book/chapters changed (client should refresh preview). */
  changed: boolean;
  isError?: boolean;
}

type ToolInput = Record<string, unknown>;

/**
 * Models love to open chapter text with "Chapter One" or the chapter title,
 * but the reader renders its own chapter header — strip that redundancy.
 */
export function cleanChapterContent(content: string, title: string): string {
  const lines = content.split("\n");
  let i = 0;
  const strip = (line: string) =>
    line
      .replace(/^#{1,4}\s*/, "")
      .replace(/^\*\*(.*)\*\*$/, "$1")
      .replace(/[.:—-]+$/, "")
      .trim();
  const chapterRx = /^chapter\s+(?:[a-z]+(?:[- ][a-z]+)?|\d+)$/i;
  while (i < lines.length) {
    const s = strip(lines[i]);
    if (s === "" && i < 4) {
      i++;
      continue;
    }
    if (chapterRx.test(s) || s.toLowerCase() === title.trim().toLowerCase()) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join("\n").trimStart();
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function int(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;
}

export async function executeStudioTool(
  bookId: mongoose.Types.ObjectId,
  toolName: string,
  input: ToolInput
): Promise<ToolOutcome> {
  const book = await Book.findById(bookId);
  if (!book) {
    return { result: "Error: book not found.", label: "Book missing", changed: false, isError: true };
  }

  switch (toolName) {
    case "set_book": {
      const title = str(input.title);
      const subtitle = typeof input.subtitle === "string" ? input.subtitle.trim() : undefined;
      const authorName = str(input.author_name);
      const description = str(input.description);
      const genre = str(input.genre);
      if (title) book.title = title.slice(0, 200);
      if (authorName) book.authorName = authorName.slice(0, 120);
      if (subtitle !== undefined) book.subtitle = subtitle.slice(0, 300);
      if (description) book.description = description.slice(0, 5000);
      if (genre && (GENRES as readonly string[]).includes(genre)) book.genre = genre;
      if (Array.isArray(input.tags)) {
        book.tags = input.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8);
      }
      const palette = int(input.cover_palette);
      const layout = int(input.cover_layout);
      if (palette !== undefined && palette >= 0 && palette < COVER_PALETTES.length) {
        book.coverStyle.palette = palette;
      } else if (title) {
        // retheme the auto cover when the title changes and no explicit pick
        book.coverStyle = coverStyleFor(book.title, book.genre) as typeof book.coverStyle;
      }
      if (layout !== undefined && layout >= 0 && layout < COVER_LAYOUT_COUNT) {
        book.coverStyle.layout = layout;
      }
      await book.save();
      return {
        result: `Book updated. Title: "${book.title}". Genre: ${book.genre}.`,
        label: `Updated book details — “${book.title}”`,
        changed: true,
      };
    }

    case "write_chapter": {
      const title = str(input.title);
      const rawContent = str(input.content);
      const content = title && rawContent ? cleanChapterContent(rawContent, title) : rawContent;
      let position = int(input.position);
      if (!title || !content || position === undefined) {
        return { result: "Error: position, title and content are required.", label: "Invalid chapter", changed: false, isError: true };
      }
      const count = await Chapter.countDocuments({ bookId });
      position = Math.max(1, Math.min(position, count + 1));

      const existing = await Chapter.findOne({ bookId, index: position });
      if (existing) {
        existing.title = title.slice(0, 200);
        existing.content = content;
        existing.wordCount = countWords(content);
        await existing.save();
      } else {
        await Chapter.create({
          bookId,
          index: position,
          title: title.slice(0, 200),
          content,
          wordCount: countWords(content),
        });
      }
      await refreshBookStats(bookId);
      const words = countWords(content);
      return {
        result: `Chapter ${position} ${existing ? "replaced" : "written"}: "${title}" (${words} words). Book now has ${existing ? count : count + 1} chapters.`,
        label: `${existing ? "Rewrote" : "Wrote"} Chapter ${position} — ${title}`,
        changed: true,
      };
    }

    case "edit_chapter": {
      const position = int(input.position);
      const chapter = position ? await Chapter.findOne({ bookId, index: position }) : null;
      if (!chapter) {
        return { result: `Error: no chapter at position ${position}.`, label: "Chapter not found", changed: false, isError: true };
      }
      const title = str(input.title);
      const content = str(input.content);
      if (title) chapter.title = title.slice(0, 200);
      if (content) {
        chapter.content = cleanChapterContent(content, chapter.title);
        chapter.wordCount = countWords(chapter.content);
      }
      await chapter.save();
      await refreshBookStats(bookId);
      return {
        result: `Chapter ${position} updated: "${chapter.title}" (${chapter.wordCount} words).`,
        label: `Edited Chapter ${position} — ${chapter.title}`,
        changed: true,
      };
    }

    case "delete_chapter": {
      const position = int(input.position);
      const chapter = position ? await Chapter.findOne({ bookId, index: position }) : null;
      if (!chapter) {
        return { result: `Error: no chapter at position ${position}.`, label: "Chapter not found", changed: false, isError: true };
      }
      const title = chapter.title;
      await chapter.deleteOne();
      await Chapter.updateMany(
        { bookId, index: { $gt: position! } },
        { $inc: { index: -1 } }
      );
      await refreshBookStats(bookId);
      return {
        result: `Chapter ${position} ("${title}") deleted.`,
        label: `Deleted Chapter ${position} — ${title}`,
        changed: true,
      };
    }

    case "generate_cover": {
      if (!imagineEnabled()) {
        return {
          result: "Error: cover generation isn't switched on for this deployment.",
          label: "Cover unavailable",
          changed: false,
          isError: true,
        };
      }
      try {
        const art = await generateCover(
          {
            title: book.title,
            subtitle: book.subtitle,
            authorName: book.authorName,
            genre: book.genre,
            description: book.description,
          },
          {
            direction: typeof input.direction === "string" ? input.direction : undefined,
            includeTitle: Boolean(input.include_title),
            titleText: typeof input.title_text === "string" ? input.title_text : undefined,
          }
        );
        book.coverUrl = art.url;
        book.updatedAt = new Date();
        await book.save();
        return {
          result: input.include_title
            ? `New cover created for "${book.title}" with the title lettered into the artwork.`
            : `New cover created and applied to "${book.title}".`,
          label: "New cover",
          changed: true,
        };
      } catch (err) {
        const message = err instanceof ImagineError ? err.message : "The cover couldn't be made.";
        return { result: `Error: ${message}`, label: "Cover failed", changed: false, isError: true };
      }
    }

    case "edit_cover": {
      const instruction = typeof input.instruction === "string" ? input.instruction.trim() : "";
      if (!instruction) {
        return {
          result: "Error: say what should change about the cover.",
          label: "Cover edit failed",
          changed: false,
          isError: true,
        };
      }
      if (!imagineEnabled()) {
        return {
          result: "Error: image editing isn't switched on for this deployment.",
          label: "Cover edit unavailable",
          changed: false,
          isError: true,
        };
      }
      if (!book.coverUrl) {
        return {
          result:
            "Error: this book has no cover artwork yet — generate_cover first, then it can be edited.",
          label: "No cover to edit",
          changed: false,
          isError: true,
        };
      }
      try {
        const art = await editCover(book.coverUrl, instruction, {
          title: book.title,
          subtitle: book.subtitle,
          genre: book.genre,
        });
        book.coverUrl = art.url;
        book.updatedAt = new Date();
        await book.save();
        return {
          result: `Cover updated: ${instruction}`,
          label: "Cover updated",
          changed: true,
        };
      } catch (err) {
        const message =
          err instanceof ImagineError ? err.message : "The cover couldn't be changed.";
        return {
          result: `Error: ${message}`,
          label: "Cover edit failed",
          changed: false,
          isError: true,
        };
      }
    }

    case "generate_chapter_image": {
      const position = int(input.position);
      const subject = typeof input.subject === "string" ? input.subject.trim() : "";
      const alt = typeof input.alt === "string" ? input.alt : "Illustration";
      if (!position || !subject) {
        return {
          result: "Error: position and subject are both required.",
          label: "Illustration failed",
          changed: false,
          isError: true,
        };
      }
      const chapter = await Chapter.findOne({ bookId, index: position });
      if (!chapter) {
        return {
          result: `Error: there is no chapter ${position} to illustrate.`,
          label: "Illustration failed",
          changed: false,
          isError: true,
        };
      }

      // Queued, not inline: image generation takes long enough that blocking
      // the conversation on it makes the Studio look frozen.
      const job = await IllustrationJob.create({
        bookId,
        chapterIndex: position,
        subject,
        alt,
        placement: input.placement === "top" ? "top" : "bottom",
      });
      void runIllustrationJob(job._id.toString());

      return {
        result: `Started the illustration for chapter ${position}. It appears in the chapter on its own shortly — keep writing meanwhile.`,
        label: `Illustrating “${chapter.title}”`,
        changed: false,
      };
    }

    case "read_chapter": {
      const position = int(input.position);
      const chapter = position ? await Chapter.findOne({ bookId, index: position }) : null;
      if (!chapter) {
        return { result: `Error: no chapter at position ${position}.`, label: "Chapter not found", changed: false, isError: true };
      }
      return {
        result: `Chapter ${position}: "${chapter.title}"\n\n${chapter.content}`,
        label: `Read Chapter ${position} — ${chapter.title}`,
        changed: false,
      };
    }

    default:
      return { result: `Error: unknown tool ${toolName}.`, label: "Unknown tool", changed: false, isError: true };
  }
}

async function refreshBookStats(bookId: mongoose.Types.ObjectId): Promise<void> {
  const chapters = await Chapter.find({ bookId }).select("wordCount");
  await Book.updateOne(
    { _id: bookId },
    {
      chapterCount: chapters.length,
      wordCount: chapters.reduce((sum, c) => sum + c.wordCount, 0),
    }
  );
}

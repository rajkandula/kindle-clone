/**
 * Lectoire's own MCP server — the tool layer that lets any MCP client
 * (Claude Code, Claude Desktop, claude.ai connectors, the API connector)
 * manage a user's library by chatting: create books, write and refine
 * chapters, publish to the store, browse and read published books.
 *
 * Authoring tools reuse the same executors as the Studio (lib/studio.ts),
 * so MCP edits and in-app edits behave identically.
 */
import mongoose from "mongoose";
import { Book, Chapter, GENRES, hasPlus, type IBook, type IUser } from "./models";
import { executeStudioTool } from "./studio";
import { narrateBook } from "./audiobook";
import { coverStyleFor } from "./covers";

/* ------------------------------------------------------------------ */
/* Tool definitions (MCP wire format)                                  */
/* ------------------------------------------------------------------ */

const BOOK_ID = {
  type: "string",
  description: "The book id (from list_my_books, browse_store, or create_book).",
};

export const MCP_TOOLS = [
  {
    name: "list_my_books",
    description:
      "List all books the user owns — drafts and published — with id, title, genre, status, chapter count, and word count.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_book",
    description:
      "Create a new book (starts as a private draft). Returns the new book id. Follow up with write_chapter to add content.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Book title." },
        genre: { type: "string", enum: [...GENRES], description: "Primary genre." },
        subtitle: { type: "string", description: "Optional subtitle." },
        description: { type: "string", description: "Back-cover blurb (needed before publishing)." },
        author_name: { type: "string", description: "Byline shown on the cover. Defaults to the user's name." },
      },
      required: ["title"],
    },
  },
  {
    name: "get_book",
    description:
      "Get a book's details and table of contents (chapter titles + word counts). Works on the user's own books and on published store books.",
    inputSchema: { type: "object", properties: { book_id: BOOK_ID }, required: ["book_id"] },
  },
  {
    name: "read_chapter",
    description:
      "Read the full text of one chapter. Works on the user's own books and on published store books — useful for reading, summarizing, or discussing any book.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: BOOK_ID,
        chapter: { type: "integer", description: "1-based chapter number." },
      },
      required: ["book_id", "chapter"],
    },
  },
  {
    name: "write_chapter",
    description:
      "Write a chapter of one of the user's books at a 1-based position (replaces the chapter if one exists there; use chapter_count+1 to append). Content is Markdown prose — write complete, polished text.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: BOOK_ID,
        position: { type: "integer", description: "1-based position." },
        title: { type: "string", description: "Chapter title, without numbering." },
        content: { type: "string", description: "Full chapter text in Markdown." },
      },
      required: ["book_id", "position", "title", "content"],
    },
  },
  {
    name: "edit_chapter",
    description:
      "Update an existing chapter's title and/or replace its full text. For line-level edits: read_chapter first, apply the change, then send the complete revised content.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: BOOK_ID,
        position: { type: "integer", description: "1-based chapter number." },
        title: { type: "string", description: "New title (omit to keep)." },
        content: { type: "string", description: "New full Markdown text (omit to keep)." },
      },
      required: ["book_id", "position"],
    },
  },
  {
    name: "delete_chapter",
    description: "Delete a chapter from one of the user's books. Later chapters shift up.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: BOOK_ID,
        position: { type: "integer", description: "1-based chapter number." },
      },
      required: ["book_id", "position"],
    },
  },
  {
    name: "update_book",
    description:
      "Update a book's metadata: title, subtitle, author byline (shown on the cover), description, or genre.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: BOOK_ID,
        title: { type: "string" },
        subtitle: { type: "string" },
        author_name: { type: "string", description: "Byline shown on the cover." },
        description: { type: "string" },
        genre: { type: "string", enum: [...GENRES] },
      },
      required: ["book_id"],
    },
  },
  {
    name: "publish_book",
    description:
      "Publish one of the user's books to the public Lectoire store. Requires at least one chapter and a description.",
    inputSchema: { type: "object", properties: { book_id: BOOK_ID }, required: ["book_id"] },
  },
  {
    name: "unpublish_book",
    description:
      "Take one of the user's books back to a private draft — it is removed from the public store.",
    inputSchema: { type: "object", properties: { book_id: BOOK_ID }, required: ["book_id"] },
  },
  {
    name: "browse_store",
    description:
      "Browse or search the public Lectoire store. Returns published books (read-only for books the user doesn't own) — combine with get_book and read_chapter to read and discuss them.",
    inputSchema: {
      type: "object",
      properties: {
        genre: { type: "string", enum: [...GENRES], description: "Filter by genre." },
        query: { type: "string", description: "Search titles, authors, descriptions, tags." },
        limit: { type: "integer", description: "Max results (default 20, max 40)." },
      },
    },
  },
  {
    name: "delete_book",
    description:
      "Permanently delete one of the user's books, including all chapters. Irreversible — requires confirm: true.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: BOOK_ID,
        confirm: { type: "boolean", description: "Must be true to actually delete." },
      },
      required: ["book_id", "confirm"],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

type ToolInput = Record<string, unknown>;

interface ToolResult {
  text: string;
  isError?: boolean;
}

const ok = (text: string): ToolResult => ({ text });
const fail = (text: string): ToolResult => ({ text, isError: true });

function bookLine(b: IBook): string {
  return `- ${b.title} (id: ${b._id}) — ${b.genre}, ${b.status}, ${b.chapterCount} chapters, ${b.wordCount.toLocaleString()} words`;
}

async function ownBook(userId: mongoose.Types.ObjectId, input: ToolInput) {
  const id = typeof input.book_id === "string" ? input.book_id : "";
  if (!mongoose.isValidObjectId(id)) return null;
  return Book.findOne({ _id: id, ownerId: userId });
}

async function readableBook(userId: mongoose.Types.ObjectId, input: ToolInput) {
  const id = typeof input.book_id === "string" ? input.book_id : "";
  if (!mongoose.isValidObjectId(id)) return null;
  const book = await Book.findById(id);
  if (!book) return null;
  const isOwn = book.ownerId?.toString() === userId.toString();
  if (book.status !== "published" && !isOwn) return null;
  return book;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function executeMcpTool(
  user: IUser,
  name: string,
  input: ToolInput
): Promise<ToolResult> {
  const userId = user._id;

  switch (name) {
    case "list_my_books": {
      const books = await Book.find({ ownerId: userId }).sort({ updatedAt: -1 }).limit(100);
      if (books.length === 0) {
        return ok("No books yet. Use create_book to start one.");
      }
      return ok(`${books.length} book(s):\n${books.map(bookLine).join("\n")}`);
    }

    case "create_book": {
      if (!hasPlus(user)) {
        return fail(
          "Creating new books requires an Lectoire Plus subscription. Subscribe on the Plus page in the Lectoire app. (Your existing books can still be edited.)"
        );
      }
      const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
      if (!title) return fail("title is required.");
      const genre =
        typeof input.genre === "string" && (GENRES as readonly string[]).includes(input.genre)
          ? input.genre
          : "Fiction";
      const book = await Book.create({
        ownerId: userId,
        title,
        subtitle: typeof input.subtitle === "string" ? input.subtitle.trim().slice(0, 300) : "",
        authorName:
          typeof input.author_name === "string" && input.author_name.trim()
            ? input.author_name.trim().slice(0, 120)
            : user.name,
        description:
          typeof input.description === "string" ? input.description.trim().slice(0, 5000) : "",
        genre,
        status: "draft",
        coverStyle: coverStyleFor(title, genre),
      });
      return ok(
        `Created draft "${book.title}" (id: ${book._id}). Add content with write_chapter; publish with publish_book once it has chapters and a description.`
      );
    }

    case "get_book": {
      const book = await readableBook(userId, input);
      if (!book) return fail("Book not found (or not accessible).");
      const chapters = await Chapter.find({ bookId: book._id })
        .sort({ index: 1 })
        .select("index title wordCount");
      const isOwn = book.ownerId?.toString() === userId.toString();
      const toc =
        chapters.length === 0
          ? "(no chapters yet)"
          : chapters.map((c) => `  ${c.index}. ${c.title} (${c.wordCount} words)`).join("\n");
      return ok(
        [
          `${book.title}${book.subtitle ? ` — ${book.subtitle}` : ""}`,
          `by ${book.authorName} · ${book.genre} · ${book.status} · ${isOwn ? "yours (editable)" : "store book (read-only)"}`,
          book.description ? `\n${book.description}` : "",
          `\nChapters (${chapters.length}):\n${toc}`,
        ].join("\n")
      );
    }

    case "read_chapter": {
      const book = await readableBook(userId, input);
      if (!book) return fail("Book not found (or not accessible).");
      const position = Number(input.chapter);
      const chapter = await Chapter.findOne({ bookId: book._id, index: position });
      if (!chapter) return fail(`No chapter ${position} in "${book.title}".`);
      return ok(`Chapter ${chapter.index}: ${chapter.title}\n(from "${book.title}")\n\n${chapter.content}`);
    }

    case "write_chapter":
    case "edit_chapter":
    case "delete_chapter": {
      const book = await ownBook(userId, input);
      if (!book) return fail("Book not found — you can only edit your own books.");
      const studioTool =
        name === "write_chapter" ? "write_chapter" : name === "edit_chapter" ? "edit_chapter" : "delete_chapter";
      const outcome = await executeStudioTool(book._id, studioTool, input);
      return outcome.isError ? fail(outcome.result) : ok(outcome.result);
    }

    case "update_book": {
      const book = await ownBook(userId, input);
      if (!book) return fail("Book not found — you can only edit your own books.");
      const outcome = await executeStudioTool(book._id, "set_book", input);
      return outcome.isError ? fail(outcome.result) : ok(outcome.result);
    }

    case "publish_book": {
      const book = await ownBook(userId, input);
      if (!book) return fail("Book not found — you can only publish your own books.");
      if (book.chapterCount === 0) return fail("Write at least one chapter before publishing.");
      if (!book.description) return fail("Add a description (update_book) before publishing.");
      book.status = "published";
      book.publishedAt = new Date();
      await book.save();
      // Audio starts being made now, not when the first reader arrives
      void narrateBook(book._id);
      return ok(
        `"${book.title}" is now live in the Lectoire store. Its audiobook is being narrated in the background.`
      );
    }

    case "unpublish_book": {
      const book = await ownBook(userId, input);
      if (!book) return fail("Book not found — you can only unpublish your own books.");
      book.status = "draft";
      await book.save();
      return ok(`"${book.title}" is back to a private draft and no longer in the store.`);
    }

    case "browse_store": {
      const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 40);
      const filter: Record<string, unknown> = { status: "published" };
      if (
        typeof input.genre === "string" &&
        (GENRES as readonly string[]).includes(input.genre)
      ) {
        filter.genre = input.genre;
      }
      if (typeof input.query === "string" && input.query.trim()) {
        const rx = new RegExp(escapeRegex(input.query.trim().slice(0, 100)), "i");
        filter.$or = [{ title: rx }, { authorName: rx }, { description: rx }, { tags: rx }];
      }
      const books = await Book.find(filter).sort({ publishedAt: -1 }).limit(limit);
      if (books.length === 0) return ok("No store books matched.");
      return ok(
        `${books.length} store book(s):\n${books
          .map((b) => `${bookLine(b)}\n    ${b.description.slice(0, 140)}`)
          .join("\n")}`
      );
    }

    case "delete_book": {
      if (input.confirm !== true) {
        return fail("Deletion is irreversible. Call again with confirm: true after the user agrees.");
      }
      const book = await ownBook(userId, input);
      if (!book) return fail("Book not found — you can only delete your own books.");
      const title = book.title;
      await Chapter.deleteMany({ bookId: book._id });
      await book.deleteOne();
      return ok(`Deleted "${title}" and all its chapters.`);
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}

export const MCP_INSTRUCTIONS = `Lectoire is a book platform. These tools manage the connected user's personal library: create books (drafts by default), write and revise chapters (Markdown prose), update metadata, and publish to / unpublish from the public store. Store books from other authors are readable (get_book, read_chapter) but not editable. When the user asks for line-level edits, read the chapter, apply the change, and save the complete revised text with edit_chapter.`;

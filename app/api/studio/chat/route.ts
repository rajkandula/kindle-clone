import { NextResponse } from "next/server";
import mongoose from "mongoose";
import type Anthropic from "@anthropic-ai/sdk";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import {
  Book,
  Chapter,
  Conversation,
  Message,
  type IToolEvent,
} from "@/lib/models";
import { getAnthropic, BOOK_MODEL } from "@/lib/anthropic";
import {
  STUDIO_TOOLS,
  buildSystemPrompt,
  executeStudioTool,
} from "@/lib/studio";
import { coverStyleFor } from "@/lib/covers";

export const maxDuration = 300;

const MAX_ROUNDS = 12;
const HISTORY_LIMIT = 40;

/** Live label shown while a tool call is still streaming in. */
const START_LABELS: Record<string, string> = {
  set_book: "Updating book details…",
  write_chapter: "Writing a chapter…",
  edit_chapter: "Revising a chapter…",
  delete_chapter: "Removing a chapter…",
  read_chapter: "Re-reading a chapter…",
};

interface BookSnapshot {
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  description: string;
  genre: string;
  tags: string[];
  status: string;
  /** Real cover artwork, when one has been generated or uploaded. */
  coverUrl: string;
  coverStyle: { palette: number; layout: number };
  wordCount: number;
  chapters: { index: number; title: string; wordCount: number }[];
}

async function snapshotBook(bookId: mongoose.Types.ObjectId): Promise<BookSnapshot | null> {
  const book = await Book.findById(bookId);
  if (!book) return null;
  const chapters = await Chapter.find({ bookId })
    .sort({ index: 1 })
    .select("index title wordCount");
  return {
    id: book._id.toString(),
    title: book.title,
    subtitle: book.subtitle,
    authorName: book.authorName,
    description: book.description,
    genre: book.genre,
    tags: book.tags,
    status: book.status,
    coverUrl: book.coverUrl ?? "",
    coverStyle: {
      palette: book.coverStyle?.palette ?? 0,
      layout: book.coverStyle?.layout ?? 0,
    },
    wordCount: book.wordCount,
    chapters: chapters.map((c) => ({
      index: c.index,
      title: c.title,
      wordCount: c.wordCount,
    })),
  };
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.plus) {
    return NextResponse.json(
      { error: "The AI writing Studio is part of Lectoire Plus. Subscribe on the Plus page to start creating books." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const conversationIdRaw =
    typeof body?.conversationId === "string" ? body.conversationId : "";
  // Generous ceiling — attached documents ride inside the message content
  if (!content || content.length > 150_000) {
    return NextResponse.json({ error: "Empty or oversized message." }, { status: 400 });
  }

  await connectDB();

  /* Find or create the studio project (conversation + draft book). */
  let conversation;
  if (conversationIdRaw) {
    if (!mongoose.isValidObjectId(conversationIdRaw)) {
      return NextResponse.json({ error: "Bad conversation id." }, { status: 400 });
    }
    conversation = await Conversation.findOne({
      _id: conversationIdRaw,
      userId: user.id,
    });
    if (!conversation) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
  } else {
    const book = await Book.create({
      ownerId: user.id,
      title: "Untitled Book",
      authorName: user.name,
      status: "draft",
      coverStyle: coverStyleFor("Untitled Book", "Fiction"),
    });
    conversation = await Conversation.create({
      userId: user.id,
      bookId: book._id,
      title: "New book project",
    });
  }

  const bookId = conversation.bookId;

  await Message.create({
    conversationId: conversation._id,
    role: "user",
    content,
  });

  /* Build model input from persisted history (text only — tool exchanges are
     not replayed; the system prompt carries current book state instead). */
  const history = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .limit(HISTORY_LIMIT * 2)
    .select("role content");
  const apiMessages: Anthropic.Beta.BetaMessageParam[] = history
    .slice(-HISTORY_LIMIT)
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  const convId = conversation._id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* client went away — keep working so the book still gets written */
        }
      };

      const assistantParts: string[] = [];
      const events: IToolEvent[] = [];

      send({
        type: "meta",
        conversationId: convId.toString(),
        bookId: bookId.toString(),
      });

      try {
        const anthropic = getAnthropic();
        let rounds = 0;
        let finished = false;

        while (!finished && rounds < MAX_ROUNDS) {
          rounds++;
          const book = await Book.findById(bookId);
          if (!book) throw new Error("Book vanished mid-conversation");
          const chapterMeta = await Chapter.find({ bookId })
            .sort({ index: 1 })
            .select("index title wordCount");

          const system = buildSystemPrompt(
            book,
            chapterMeta.map((c) => ({
              index: c.index,
              title: c.title,
              wordCount: c.wordCount,
            }))
          );

          const msgStream = anthropic.beta.messages.stream({
            model: BOOK_MODEL,
            max_tokens: 16_000,
            system,
            messages: apiMessages,
            tools: STUDIO_TOOLS as unknown as Anthropic.Beta.BetaToolUnion[],
          });

          msgStream.on("text", (text) => {
            assistantParts.push(text);
            send({ type: "delta", text });
          });
          msgStream.on("streamEvent", (event) => {
            if (event.type !== "content_block_start") return;
            const block = event.content_block as { type: string; name?: string };
            if (block.type === "tool_use") {
              send({
                type: "status",
                label: START_LABELS[block.name ?? ""] ?? "Working on the book…",
              });
            }
          });

          const final = await msgStream.finalMessage();

          if (final.stop_reason === "tool_use") {
            apiMessages.push({ role: "assistant", content: final.content });
            const results: Anthropic.ToolResultBlockParam[] = [];

            for (const block of final.content) {
              if (block.type !== "tool_use") continue;
              const outcome = await executeStudioTool(
                bookId,
                block.name,
                (block.input ?? {}) as Record<string, unknown>
              );
              events.push({ tool: block.name, label: outcome.label });
              send({ type: "action", label: outcome.label, error: outcome.isError });
              if (outcome.changed) {
                const snap = await snapshotBook(bookId);
                if (snap) send({ type: "book", book: snap });
              }
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: outcome.result,
                ...(outcome.isError ? { is_error: true } : {}),
              });
            }
            apiMessages.push({ role: "user", content: results });
          } else {
            finished = true;
          }
        }

        if (!finished) {
          send({
            type: "delta",
            text: "\n\n*(Paused — that was a lot of writing in one go. Say \"continue\" to keep working.)*",
          });
        }
      } catch (err) {
        console.error("studio chat error:", err);
        send({
          type: "error",
          message:
            "The Studio hit a snag talking to the writing model. Your book is safe — try again.",
        });
      } finally {
        /* Persist whatever happened, even on abort/error. */
        try {
          const text = assistantParts.join("");
          if (text.trim() || events.length > 0) {
            await Message.create({
              conversationId: convId,
              role: "assistant",
              content: text,
              events,
            });
          }
          const book = await Book.findById(bookId).select("title");
          conversation.lastMessageAt = new Date();
          if (book && book.title && book.title !== "Untitled Book") {
            conversation.title = book.title;
          }
          await conversation.save();

          const snap = await snapshotBook(bookId);
          if (snap) send({ type: "book", book: snap });
          send({ type: "done" });
        } catch (persistErr) {
          console.error("studio persist error:", persistErr);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

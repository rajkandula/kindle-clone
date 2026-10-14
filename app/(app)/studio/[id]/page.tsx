import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Chapter, Conversation, Message } from "@/lib/models";
import { StudioView, type StudioBook, type StudioMessage } from "@/components/StudioView";

export const dynamic = "force-dynamic";

export default async function StudioProject({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const conversation = await Conversation.findOne({ _id: id, userId: user.id });
  if (!conversation) notFound();

  const [book, chapters, messages] = await Promise.all([
    Book.findById(conversation.bookId),
    Chapter.find({ bookId: conversation.bookId })
      .sort({ index: 1 })
      .select("index title wordCount"),
    Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).limit(200),
  ]);
  if (!book) notFound();

  const studioBook: StudioBook = {
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

  const studioMessages: StudioMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
    events: m.events.map((e) => ({ tool: e.tool, label: e.label })),
  }));

  return (
    <StudioView
      initialConversationId={conversation._id.toString()}
      initialBook={studioBook}
      initialMessages={studioMessages}
    />
  );
}

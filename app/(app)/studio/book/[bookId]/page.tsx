import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Conversation } from "@/lib/models";

export const dynamic = "force-dynamic";

/**
 * Open any owned book in the Studio — books created outside a Studio chat
 * (via the Claude connector or the manual editor) get a conversation
 * attached on first open, so the AI has the book's full context.
 */
export default async function StudioForBook({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { bookId } = await params;
  if (!mongoose.isValidObjectId(bookId)) notFound();

  await connectDB();
  const book = await Book.findOne({ _id: bookId, ownerId: user.id });
  if (!book) notFound();

  let conversation = await Conversation.findOne({ bookId: book._id, userId: user.id });
  if (!conversation) {
    conversation = await Conversation.create({
      userId: user.id,
      bookId: book._id,
      title: book.title,
      lastMessageAt: new Date(),
    });
  }

  redirect(`/studio/${conversation._id}`);
}

import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { minListPrice, printCostPerCopy } from "@/lib/pricing";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Chapter } from "@/lib/models";
import { EditorView } from "@/components/EditorView";

export const metadata = { title: "Edit book" };
export const dynamic = "force-dynamic";

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const book = await Book.findOne({ _id: id, ownerId: user.id });
  if (!book) notFound();

  const chapters = await Chapter.find({ bookId: book._id })
    .sort({ index: 1 })
    .select("index title content wordCount");

  return (
    <EditorView
      book={{
        id: book._id.toString(),
        title: book.title,
        subtitle: book.subtitle,
        authorName: book.authorName,
        description: book.description,
        genre: book.genre,
        status: book.status,
        sale: {
          enabled: book.sale?.enabled ?? false,
          priceCents: book.sale?.priceCents ?? 0,
          printPriceCents: book.sale?.printPriceCents ?? 0,
        },
        printCostCents: printCostPerCopy(book),
        minPrintPriceCents: minListPrice(book),
        free: book.flags?.free ?? false,
      }}
      initialChapters={chapters.map((c) => ({
        index: c.index,
        title: c.title,
        content: c.content,
        wordCount: c.wordCount,
      }))}
    />
  );
}

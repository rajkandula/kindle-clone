import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Book, Chapter } from "@/lib/models";
import { executeStudioTool } from "@/lib/studio";

/** Add a chapter at the end. Body: { title?, content? } */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));

  await connectDB();
  const book = await Book.findOne({ _id: id, ownerId: userId });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const count = await Chapter.countDocuments({ bookId: book._id });
  const outcome = await executeStudioTool(book._id, "write_chapter", {
    position: count + 1,
    title:
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim()
        : `Chapter ${count + 1}`,
    content:
      typeof body?.content === "string" && body.content.trim()
        ? body.content
        : "Start writing…",
  });
  if (outcome.isError) {
    return NextResponse.json({ error: outcome.result }, { status: 400 });
  }
  return NextResponse.json({ ok: true, index: count + 1 });
}

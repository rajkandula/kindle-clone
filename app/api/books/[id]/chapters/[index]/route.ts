import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Book } from "@/lib/models";
import { executeStudioTool } from "@/lib/studio";

async function ownBook(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return Book.findOne({ _id: id, ownerId: userId });
}

/** Edit a chapter's title and/or content. Body: { title?, content? } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, index } = await params;
  const position = parseInt(index, 10);
  if (!Number.isInteger(position) || position < 1) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title : undefined;
  const content = typeof body?.content === "string" ? body.content : undefined;
  if (title === undefined && content === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const book = await ownBook(userId, id);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const outcome = await executeStudioTool(book._id, "edit_chapter", {
    position,
    ...(title !== undefined ? { title } : {}),
    ...(content !== undefined ? { content } : {}),
  });
  if (outcome.isError) {
    return NextResponse.json({ error: outcome.result }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** Delete a chapter (later chapters shift up). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, index } = await params;
  const position = parseInt(index, 10);
  if (!Number.isInteger(position) || position < 1) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const book = await ownBook(userId, id);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const outcome = await executeStudioTool(book._id, "delete_chapter", { position });
  if (outcome.isError) {
    return NextResponse.json({ error: outcome.result }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

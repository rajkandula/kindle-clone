import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 80_000;

/**
 * Extract text from an uploaded document so the Studio AI can use it as
 * source material (notes, a manuscript, research, an outline…).
 * Supports PDF, DOCX, TXT, and Markdown.
 */
export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.plus) {
    return NextResponse.json(
      { error: "Document upload is part of Lectoire Plus." },
      { status: 403 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "That file is over 10 MB — try a smaller document." },
      { status: 400 }
    );
  }

  const name = file.name || "document";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  let text = "";
  try {
    if (ext === "pdf" || file.type === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const result = await extractText(pdf, { mergePages: true });
      text = result.text;
    } else if (
      ext === "docx" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(await file.arrayBuffer()),
      });
      text = result.value;
    } else if (["txt", "md", "markdown", "text"].includes(ext) || file.type.startsWith("text/")) {
      text = await file.text();
    } else {
      return NextResponse.json(
        { error: "Unsupported file type — use PDF, DOCX, TXT, or Markdown." },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("document extraction failed:", err);
    return NextResponse.json(
      { error: "Couldn't read that document — is it valid and not password-protected?" },
      { status: 422 }
    );
  }

  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!text) {
    return NextResponse.json(
      { error: "No readable text found in that document (is it a scanned image?)." },
      { status: 422 }
    );
  }

  const truncated = text.length > MAX_TEXT_CHARS;
  if (truncated) text = text.slice(0, MAX_TEXT_CHARS);
  const words = text.split(/\s+/).filter(Boolean).length;

  return NextResponse.json({ name, text, words, truncated });
}

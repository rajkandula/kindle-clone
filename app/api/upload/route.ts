import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { isStorageConfigured, presignUpload } from "@/lib/storage";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Issue a presigned PUT URL so the browser uploads media (book covers)
 * directly to object storage — big files never pass through this server.
 * Body: { name, contentType, size }
 */
export async function POST(req: Request) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Media storage not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "file";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = Number(body?.size);

  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: "Only image uploads are allowed." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 400 });
  }

  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "bin";
  const key = `lectoire/covers/${userId}/${randomUUID()}.${ext.slice(0, 8)}`;
  const { uploadUrl, publicUrl } = await presignUpload(key, contentType, size);

  return NextResponse.json({ uploadUrl, publicUrl, key });
}

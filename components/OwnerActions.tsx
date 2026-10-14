"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ImagePlus, ImageOff, Loader2, Trash2 } from "lucide-react";

/** Cover upload / removal + delete, shown only to the book's owner. */
export function OwnerActions({
  bookId,
  hasCustomCover,
}: {
  bookId: string;
  hasCustomCover: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | "delete" | null>(null);
  const [error, setError] = useState("");

  async function uploadCover(file: File) {
    setBusy("upload");
    setError("");
    try {
      const presign = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }),
      });
      const data = await presign.json().catch(() => ({}));
      if (!presign.ok) throw new Error(data.error ?? "Upload not available.");

      const put = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Storage upload failed — try again.");

      const patch = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: data.publicUrl }),
      });
      if (!patch.ok) throw new Error("Could not save the new cover.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function removeCover() {
    setBusy("remove");
    setError("");
    try {
      await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: "" }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteBook() {
    if (!window.confirm("Delete this book, its chapters, and its Studio project? This cannot be undone.")) {
      return;
    }
    setBusy("delete");
    setError("");
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete the book.");
      router.push("/studio");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="mt-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadCover(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/books/${bookId}/download`}
          download
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {busy === "upload" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          {hasCustomCover ? "Replace cover" : "Upload cover"}
        </button>
        {hasCustomCover && (
          <button
            onClick={removeCover}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            {busy === "remove" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageOff className="h-3.5 w-3.5" />
            )}
            Use generated cover
          </button>
        )}
        <button
          onClick={deleteBook}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          {busy === "delete" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Delete book
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

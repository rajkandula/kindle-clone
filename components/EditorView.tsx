"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Check,
  ChevronLeft,
  CloudUpload,
  Info,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { GENRES } from "@/lib/genres";
import { NarrationPanel } from "./NarrationPanel";
import { PriceControl } from "./PriceControl";

interface EditorBook {
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  description: string;
  genre: string;
  status: string;
  /** Selling terms — a price moves the book out of Plus. */
  sale?: { enabled: boolean; priceCents: number; printPriceCents: number };
  printCostCents?: number;
  minPrintPriceCents?: number;
  free?: boolean;
}

interface EditorChapter {
  index: number;
  title: string;
  content: string;
  wordCount: number;
}

type SaveState = "saved" | "dirty" | "saving" | "error";

const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * Manual book editor: chapter navigation, a clean markdown writing surface,
 * debounced autosave, chapter add/delete, and book-details editing.
 */
export function EditorView({
  book: initialBook,
  initialChapters,
}: {
  book: EditorBook;
  initialChapters: EditorChapter[];
}) {
  const router = useRouter();
  const [book, setBook] = useState(initialBook);
  const [chapters, setChapters] = useState(initialChapters);
  /** null → book-details panel; otherwise the chapter index being edited. */
  const [current, setCurrent] = useState<number | null>(
    initialChapters.length > 0 ? initialChapters[0].index : null
  );
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [busy, setBusy] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest values, so debounced/unload saves never send stale state
  const pendingRef = useRef<{ book: EditorBook; chapters: EditorChapter[] }>({
    book: initialBook,
    chapters: initialChapters,
  });
  const dirtyRef = useRef<{ details: boolean; chapters: Set<number> }>({
    details: false,
    chapters: new Set(),
  });

  const chapter = useMemo(
    () => chapters.find((c) => c.index === current) ?? null,
    [chapters, current]
  );

  /* ---------------- autosave ---------------- */

  const flush = useCallback(async () => {
    const dirty = dirtyRef.current;
    if (!dirty.details && dirty.chapters.size === 0) return;
    setSaveState("saving");
    const { book: b, chapters: chs } = pendingRef.current;
    const jobs: Promise<Response>[] = [];

    if (dirty.details) {
      jobs.push(
        fetch(`/api/books/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: b.title,
            subtitle: b.subtitle,
            authorName: b.authorName,
            description: b.description,
            genre: b.genre,
          }),
          keepalive: true,
        })
      );
    }
    for (const idx of dirty.chapters) {
      const ch = chs.find((c) => c.index === idx);
      if (!ch) continue;
      jobs.push(
        fetch(`/api/books/${b.id}/chapters/${idx}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: ch.title, content: ch.content }),
          keepalive: true,
        })
      );
    }

    dirtyRef.current = { details: false, chapters: new Set() };
    try {
      const results = await Promise.all(jobs);
      setSaveState(results.every((r) => r.ok) ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 1200);
  }, [flush]);

  /* Save on Cmd/Ctrl+S, tab close, and unmount. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (saveTimer.current) clearTimeout(saveTimer.current);
        void flush();
      }
    };
    const onBeforeUnload = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flush();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      onBeforeUnload();
    };
  }, [flush]);

  /* ---------------- mutations ---------------- */

  function updateBook(patch: Partial<EditorBook>) {
    setBook((b) => {
      const next = { ...b, ...patch };
      pendingRef.current.book = next;
      return next;
    });
    dirtyRef.current.details = true;
    scheduleSave();
  }

  function updateChapter(index: number, patch: Partial<EditorChapter>) {
    setChapters((chs) => {
      const next = chs.map((c) =>
        c.index === index
          ? {
              ...c,
              ...patch,
              wordCount:
                patch.content !== undefined ? wordsOf(patch.content) : c.wordCount,
            }
          : c
      );
      pendingRef.current.chapters = next;
      return next;
    });
    dirtyRef.current.chapters.add(index);
    scheduleSave();
  }

  async function addChapter() {
    if (busy) return;
    setBusy(true);
    try {
      await flush();
      const res = await fetch(`/api/books/${book.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const index = data.index as number;
        setChapters((chs) => {
          const next = [
            ...chs,
            { index, title: `Chapter ${index}`, content: "Start writing…", wordCount: 2 },
          ];
          pendingRef.current.chapters = next;
          return next;
        });
        setCurrent(index);
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteChapter(index: number) {
    if (busy) return;
    if (!window.confirm(`Delete chapter ${index}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await flush();
      const res = await fetch(`/api/books/${book.id}/chapters/${index}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setChapters((chs) => {
          const next = chs
            .filter((c) => c.index !== index)
            .map((c) => (c.index > index ? { ...c, index: c.index - 1 } : c));
          pendingRef.current.chapters = next;
          return next;
        });
        setCurrent((cur) => {
          if (cur === null || cur === index) return null;
          return cur > index ? cur - 1 : cur;
        });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- render ---------------- */

  const saveLabel: Record<SaveState, string> = {
    saved: "All changes saved",
    dirty: "Unsaved changes…",
    saving: "Saving…",
    error: "Save failed — retrying on next edit",
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper md:left-60">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/store/${book.id}`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="max-w-44 truncate font-semibold text-ink sm:max-w-80">
              {book.title}
            </span>
          </Link>
          <span className="hidden rounded-full bg-raised px-2.5 py-0.5 text-[11px] font-semibold text-muted sm:block">
            Editing
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 text-xs ${
              saveState === "error" ? "text-red-600" : "text-muted"
            }`}
          >
            {saveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <CloudUpload className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:block">{saveLabel[saveState]}</span>
          </span>
          <Link
            href={`/read/${book.id}`}
            className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
          >
            <BookOpenText className="h-3.5 w-3.5" /> Read
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chapter navigation */}
        <nav className="flex w-60 shrink-0 flex-col border-r border-line bg-surface sm:w-72">
          <button
            onClick={() => setCurrent(null)}
            className={`flex items-center gap-2.5 border-b border-line px-5 py-3.5 text-left text-[13.5px] font-medium transition-colors ${
              current === null ? "bg-accent-soft text-accent-deep" : "hover:bg-raised"
            }`}
          >
            <Info className="h-4 w-4 shrink-0" />
            Book details
          </button>
          <div className="flex-1 overflow-y-auto thin-scrollbar">
            {chapters.map((c) => (
              <div
                key={c.index}
                className={`group flex items-center border-b border-line transition-colors ${
                  current === c.index ? "bg-accent-soft" : "hover:bg-raised"
                }`}
              >
                <button
                  onClick={() => setCurrent(c.index)}
                  className="flex min-w-0 flex-1 items-baseline gap-2.5 px-5 py-3 text-left"
                >
                  <span
                    className={`w-5 shrink-0 font-mono text-xs ${
                      current === c.index ? "text-accent-deep" : "text-faint"
                    }`}
                  >
                    {c.index}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[13.5px] leading-snug ${
                      current === c.index ? "font-semibold text-accent-deep" : ""
                    }`}
                  >
                    {c.title}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-faint">
                    {c.wordCount}w
                  </span>
                </button>
                <button
                  onClick={() => void deleteChapter(c.index)}
                  title={`Delete chapter ${c.index}`}
                  aria-label={`Delete chapter ${c.index}`}
                  className="mr-2 hidden rounded-md p-1.5 text-faint transition-colors group-hover:block hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => void addChapter()}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 border-t border-line px-5 py-3.5 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add chapter
          </button>
        </nav>

        {/* Editing surface */}
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          {current === null ? (
            /* ---------- book details form ---------- */
            <div className="mx-auto max-w-2xl px-6 py-10 sm:px-8">
              <h2 className="font-display mb-6 text-2xl font-semibold">Book details</h2>
              <div className="mb-6 space-y-4">
                <NarrationPanel bookId={book.id} />
                <PriceControl
                  bookId={book.id}
                  initialEnabled={book.sale?.enabled ?? false}
                  initialPriceCents={book.sale?.priceCents ?? 0}
                  initialPrintPriceCents={book.sale?.printPriceCents ?? 0}
                  printCostCents={book.printCostCents ?? 0}
                  minPrintPriceCents={book.minPrintPriceCents ?? 0}
                  isFree={book.free ?? false}
                />
              </div>
              <div className="space-y-5">
                <Field label="Title">
                  <input
                    value={book.title}
                    onChange={(e) => updateBook({ title: e.target.value })}
                    maxLength={200}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] font-semibold outline-none transition-colors focus:border-accent"
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    value={book.subtitle}
                    onChange={(e) => updateBook({ subtitle: e.target.value })}
                    maxLength={300}
                    placeholder="Optional tagline"
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Author name (shown on the cover)">
                    <input
                      value={book.authorName}
                      onChange={(e) => updateBook({ authorName: e.target.value })}
                      maxLength={120}
                      className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
                    />
                  </Field>
                  <Field label="Genre">
                    <select
                      value={book.genre}
                      onChange={(e) => updateBook({ genre: e.target.value })}
                      className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
                    >
                      {GENRES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Description (back-cover blurb)">
                  <textarea
                    value={book.description}
                    onChange={(e) => updateBook({ description: e.target.value })}
                    rows={5}
                    maxLength={5000}
                    className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-accent"
                  />
                </Field>
                <p className="text-xs leading-relaxed text-faint">
                  Changes here update the generated cover automatically. Everything
                  autosaves as you type — {saveLabel[saveState].toLowerCase()}.
                </p>
              </div>
            </div>
          ) : chapter ? (
            /* ---------- chapter editor ---------- */
            <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-8 sm:px-10">
              <div className="mb-4 flex items-baseline gap-3">
                <span className="font-mono text-sm text-faint">{chapter.index}.</span>
                <input
                  value={chapter.title}
                  onChange={(e) => updateChapter(chapter.index, { title: e.target.value })}
                  maxLength={200}
                  placeholder="Chapter title"
                  className="font-display w-full border-b border-transparent bg-transparent text-2xl font-semibold outline-none transition-colors focus:border-line"
                />
              </div>
              <textarea
                value={chapter.content}
                onChange={(e) =>
                  updateChapter(chapter.index, { content: e.target.value })
                }
                spellCheck
                placeholder="Write in Markdown — *italics*, **bold**, *** for scene breaks…"
                className="reading-prose min-h-0 w-full flex-1 resize-none bg-transparent outline-none"
                style={{ fontSize: "1.05rem", lineHeight: 1.8 }}
              />
              <div className="border-t border-line py-2.5 text-right text-xs text-faint">
                {chapter.wordCount.toLocaleString()} words · Markdown supported ·
                autosaves as you type
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted">
              <p>Select a chapter to edit, or add one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

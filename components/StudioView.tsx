"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  expandCommand,
  matchCommands,
  slashQuery,
  type StudioCommand,
} from "@/lib/studio-commands";
import Link from "next/link";
import {
  ArrowUp,
  BookOpenText,
  ChevronLeft,
  Download,
  Feather,
  FileText,
  Loader2,
  Mic,
  PanelRight,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { Cover } from "./Cover";
import { Markdown } from "./Markdown";
import { PublishButton } from "./PublishButton";

/* ------------------------------------------------------------------ */
/* Types shared with the chat route                                    */
/* ------------------------------------------------------------------ */

export interface StudioBook {
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  description: string;
  genre: string;
  tags: string[];
  status: string;
  /** Real cover artwork once generated or uploaded; empty means use the
   *  typeset fallback that Cover draws from title + palette. */
  coverUrl: string;
  coverStyle: { palette: number; layout: number };
  wordCount: number;
  chapters: { index: number; title: string; wordCount: number }[];
}

export interface StudioMessage {
  role: "user" | "assistant";
  content: string;
  events: { tool: string; label: string }[];
}

const SUGGESTIONS = [
  "A cozy mystery set in a mountain-town bookshop",
  "A sci-fi novella about the last gardener on Mars",
  "A practical guide to running a small bakery",
  "A children's bedtime book about a lighthouse cat",
];

/** Marker separating the typed prompt from attached document text. */
const ATTACH_MARKER = "\n\n[Attached document: ";

interface Attachment {
  name: string;
  text: string;
  words: number;
  truncated: boolean;
}

/* Minimal Web Speech API surface (not in TS's DOM lib). */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

/** Split a stored user message into its prompt + attachment chip label. */
export function splitUserMessage(content: string): { text: string; docName: string | null } {
  const at = content.indexOf(ATTACH_MARKER);
  if (at === -1) return { text: content, docName: null };
  const nameEnd = content.indexOf("]", at + ATTACH_MARKER.length);
  return {
    text: content.slice(0, at).trim(),
    docName:
      nameEnd === -1 ? "document" : content.slice(at + ATTACH_MARKER.length, nameEnd),
  };
}

/* ------------------------------------------------------------------ */

export function StudioView({
  initialConversationId,
  initialBook,
  initialMessages,
}: {
  initialConversationId?: string;
  initialBook?: StudioBook | null;
  initialMessages?: StudioMessage[];
}) {
  const [conversationId, setConversationId] = useState(initialConversationId ?? "");
  const [book, setBook] = useState<StudioBook | null>(initialBook ?? null);
  const [messages, setMessages] = useState<StudioMessage[]>(initialMessages ?? []);
  const [draft, setDraft] = useState("");
  /** Highlighted row in the slash menu. */
  const [cmdIndex, setCmdIndex] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveActions, setLiveActions] = useState<string[]>([]);
  const [liveStatus, setLiveStatus] = useState("");
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Slash menu: only ever opens on a slash that starts the message. */
  const slashText = slashQuery(draft);
  const commands =
    slashText === null ? [] : matchCommands(slashText);
  const menuOpen = commands.length > 0;

  /** Fill the composer with a command, ready for its argument. */
  function pickCommand(cmd: StudioCommand) {
    if (cmd.argHint === "") {
      void send(cmd.build(""));
      setDraft("");
    } else {
      setDraft(`/${cmd.name} `);
    }
    setCmdIndex(0);
    inputRef.current?.focus();
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationBaseRef = useRef("");

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  /* ---------- document attachment ---------- */

  async function onPickFile(file: File) {
    if (uploading) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/studio/extract", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't read that document.");
        return;
      }
      setAttachment({
        name: data.name,
        text: data.text,
        words: data.words,
        truncated: Boolean(data.truncated),
      });
    } catch {
      setError("Upload failed — try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* ---------- voice dictation (Web Speech API) ---------- */

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    dictationBaseRef.current = draft ? draft.replace(/\s+$/, "") + " " : "";
    rec.onresult = (e) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += r[0].transcript;
        else interim += r[0].transcript;
      }
      setDraft((dictationBaseRef.current + finals + interim).trimStart());
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      inputRef.current?.focus();
    };
    rec.onerror = () => {
      setListening(false);
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  /* Auto-scroll chat while streaming. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, liveText, liveActions, liveStatus]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function send(text: string) {
    if (listening) recognitionRef.current?.stop();
    let content = expandCommand(text.trim());
    if ((!content && !attachment) || streaming) return;
    if (attachment) {
      if (!content) {
        content = "I've attached a document — use it as source material for our book.";
      }
      content += `${ATTACH_MARKER}${attachment.name}]\n${attachment.text}`;
      setAttachment(null);
    }
    setError("");
    setDraft("");
    setStreaming(true);
    setLiveText("");
    setLiveActions([]);
    setLiveStatus("Thinking…");
    setMessages((m) => [...m, { role: "user", content, events: [] }]);

    const controller = new AbortController();
    abortRef.current = controller;

    // Collected locally so the finally block sees final values
    let collectedText = "";
    const collectedActions: string[] = [];

    try {
      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          content,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "The Studio is unavailable right now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          switch (event.type) {
            case "meta": {
              const id = String(event.conversationId);
              if (!conversationId) {
                setConversationId(id);
                window.history.replaceState(null, "", `/studio/${id}`);
              }
              break;
            }
            case "delta":
              collectedText += String(event.text ?? "");
              setLiveText(collectedText);
              setLiveStatus("");
              break;
            case "status":
              setLiveStatus(String(event.label ?? ""));
              break;
            case "action": {
              const label = String(event.label ?? "");
              collectedActions.push(label);
              setLiveActions([...collectedActions]);
              setLiveStatus("");
              break;
            }
            case "book":
              setBook(event.book as StudioBook);
              break;
            case "error":
              setError(String(event.message ?? "Something went wrong."));
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Connection lost — try again.");
      }
    } finally {
      setStreaming(false);
      setLiveStatus("");
      if (collectedText || collectedActions.length) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: collectedText,
            events: collectedActions.map((label) => ({ tool: "", label })),
          },
        ]);
      }
      setLiveText("");
      setLiveActions([]);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  const empty = messages.length === 0 && !streaming;

  return (
    <div className="fixed inset-0 z-40 flex bg-paper md:left-60">
      {/* ---------------- Chat column ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/studio"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              title="All projects"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </Link>
            <Feather className="h-4 w-4 shrink-0 text-accent" />
            <h1 className="truncate text-sm font-semibold">
              {book?.title && book.title !== "Untitled Book"
                ? book.title
                : "New book project"}
            </h1>
          </div>
          <button
            onClick={() => setPreviewOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-ink lg:hidden"
          >
            <PanelRight className="h-4 w-4" /> Book
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
            {empty && (
              <div className="fade-up mt-10 text-center">
                <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft">
                  <Sparkles className="h-6 w-6 text-accent" />
                </span>
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  What book shall we write?
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                  Describe an idea and I&apos;ll shape it into a real book — title,
                  cover, chapters. You&apos;ll see it grow in the panel as we talk,
                  and you can read or publish it anytime.
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-[13px] leading-snug text-muted transition-colors hover:border-accent/40 hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="mb-5 flex justify-end">
                  {(() => {
                    const { text, docName } = splitUserMessage(m.content);
                    return (
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-white">
                        {text}
                        {docName && (
                          <span className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-medium">
                            <FileText className="h-3.5 w-3.5 shrink-0" /> {docName}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div key={i} className="mb-6">
                  {m.events.length > 0 && <ActionFeed labels={m.events.map((e) => e.label)} />}
                  {m.content && <Markdown content={m.content} />}
                </div>
              )
            )}

            {/* Live streaming block */}
            {streaming && (
              <div className="mb-6">
                {liveActions.length > 0 && <ActionFeed labels={liveActions} />}
                {liveText && <Markdown content={liveText} />}
                {(liveStatus || !liveText) && (
                  <div className="mt-2 flex items-center gap-2.5 text-sm text-muted">
                    <span className="flex gap-1">
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
                    </span>
                    {liveStatus || "Writing…"}
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-surface/90 px-4 py-3 backdrop-blur sm:px-6">
          <form onSubmit={onSubmit} className="relative mx-auto max-w-2xl">
            {menuOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-book">
                <p className="px-3.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase">
                  Studio commands
                </p>
                {commands.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    onMouseEnter={() => setCmdIndex(i)}
                    onClick={() => pickCommand(c)}
                    className={`flex w-full cursor-pointer items-baseline gap-2.5 px-3.5 py-2 text-left transition-colors ${
                      i === cmdIndex ? "bg-raised" : ""
                    }`}
                  >
                    <span className="font-mono text-[13px] font-semibold text-accent-deep">
                      /{c.name}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{c.label}</span>
                      <span className="block text-xs text-muted">{c.hint}</span>
                    </span>
                  </button>
                ))}
                <p className="border-t border-line px-3.5 py-2 text-[11px] text-faint">
                  ↑↓ to choose · Tab or Enter to pick · Esc to dismiss
                </p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
            <div className="rounded-3xl border border-line bg-paper px-2.5 pt-1.5 pb-2 shadow-book-sm transition-colors focus-within:border-accent">
              {/* chips row (attachment / listening) lives inside the field */}
              {(attachment || listening) && (
                <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5 pb-1">
                  {attachment && (
                    <span className="flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-2.5 text-xs font-medium">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="max-w-48 truncate">{attachment.name}</span>
                      <span className="shrink-0 text-faint">
                        {attachment.words.toLocaleString()}w
                        {attachment.truncated ? " (trimmed)" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        aria-label="Remove attachment"
                        className="shrink-0 cursor-pointer rounded-full p-1 text-faint transition-colors hover:bg-raised hover:text-ink"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {listening && (
                    <span className="flex items-center gap-2 py-1 text-xs font-medium text-accent">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                      </span>
                      Listening — tap the mic to stop
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-end gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || streaming}
                  title="Attach a document (PDF, DOCX, TXT, MD)"
                  aria-label="Attach a document"
                  className="mb-0.5 grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
                >
                  {uploading ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Paperclip className="h-4.5 w-4.5" />
                  )}
                </button>
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleDictation}
                    disabled={streaming}
                    title={listening ? "Stop dictating" : "Dictate your idea"}
                    aria-label={listening ? "Stop dictating" : "Start dictating"}
                    className={`mb-0.5 grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors disabled:opacity-40 ${
                      listening
                        ? "bg-accent text-white hover:bg-accent-deep"
                        : "text-muted hover:bg-raised hover:text-ink"
                    }`}
                  >
                    <Mic className="h-4.5 w-4.5" />
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setCmdIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (menuOpen) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setCmdIndex((i) => (i + 1) % commands.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setCmdIndex((i) => (i - 1 + commands.length) % commands.length);
                        return;
                      }
                      if (e.key === "Tab" || e.key === "Enter") {
                        e.preventDefault();
                        pickCommand(commands[cmdIndex] ?? commands[0]);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setDraft("");
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(draft);
                    }
                  }}
                  rows={Math.min(5, Math.max(1, draft.split("\n").length))}
                  placeholder={
                    empty
                      ? "Describe the book you want to write…"
                      : "Continue the conversation… (\"write the next chapter\")"
                  }
                  className="max-h-40 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-[14px] leading-relaxed outline-none"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    title="Stop"
                    aria-label="Stop generating"
                    className="mb-0.5 grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-white transition-opacity hover:opacity-85"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!draft.trim() && !attachment}
                    title="Send"
                    aria-label="Send message"
                    className="mb-0.5 grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-white shadow-book-sm transition-all hover:bg-accent-deep disabled:opacity-40"
                  >
                    <ArrowUp className="h-4.5 w-4.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1.5 px-2 text-center text-[11px] text-faint">
              Attach notes or a manuscript, dictate with the mic, or just type —
              Enter sends, Shift+Enter for a new line.
            </p>
          </form>
        </div>
      </div>

      {/* ---------------- Book preview panel ---------------- */}
      <aside
        className={`${
          previewOpen ? "flex" : "hidden"
        } w-full max-w-sm flex-col border-l border-line bg-surface lg:flex`}
      >
        <div className="flex-1 overflow-y-auto p-6 thin-scrollbar">
          {!book ? (
            <div className="mt-16 text-center text-sm text-muted">
              <BookOpenText className="mx-auto mb-3 h-8 w-8 text-faint" />
              Your book appears here as we write it.
            </div>
          ) : (
            <>
              <Cover book={book} className="mx-auto w-44 shadow-book" />
              <h2 className="font-display mt-5 text-center text-xl leading-tight font-semibold text-balance">
                {book.title}
              </h2>
              {book.subtitle && (
                <p className="mt-1 text-center text-sm text-muted">{book.subtitle}</p>
              )}
              <p className="mt-1.5 text-center text-xs font-medium text-accent">
                {book.authorName}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-deep">
                  {book.genre}
                </span>
                <span className="rounded-full bg-raised px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  {book.wordCount.toLocaleString()} words
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    book.status === "published"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {book.status === "published" ? "Published" : "Draft"}
                </span>
              </div>

              {book.description && (
                <p className="mt-4 rounded-xl bg-paper p-3.5 text-[12.5px] leading-relaxed text-muted">
                  {book.description}
                </p>
              )}

              <div className="mt-5">
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-faint uppercase">
                  Chapters ({book.chapters.length})
                </p>
                {book.chapters.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-faint">
                    No chapters yet
                  </p>
                ) : (
                  <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {book.chapters.map((c) => (
                      <li
                        key={c.index}
                        className="flex items-baseline gap-2.5 bg-surface px-3 py-2.5 text-[13px]"
                      >
                        <span className="w-5 shrink-0 font-mono text-[11px] text-faint">
                          {c.index}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {c.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-faint">
                          {c.wordCount}w
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>

        {book && book.chapters.length > 0 && (
          <div className="space-y-2 border-t border-line p-4">
            <div className="flex gap-2">
              <Link
                href={`/read/${book.id}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
              >
                <BookOpenText className="h-4 w-4" /> Read
              </Link>
              <Link
                href={`/edit/${book.id}`}
                className="flex flex-1 items-center justify-center rounded-full border border-line bg-surface py-2.5 text-[13px] font-semibold transition-colors hover:bg-raised"
              >
                Edit
              </Link>
              <a
                href={`/api/books/${book.id}/download`}
                download
                title="Download (ZIP: EPUB, PDF, DOCX, HTML, MD, TXT)"
                aria-label="Download book"
                className="grid w-11 place-items-center rounded-full border border-line bg-surface transition-colors hover:bg-raised"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
            <div className="[&>span]:w-full [&_button]:w-full [&_button]:justify-center">
              <PublishButton bookId={book.id} published={book.status === "published"} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/** Collapsed feed of the actions the AI took this turn (wrote ch. 3, etc.) */
function ActionFeed({ labels }: { labels: string[] }) {
  return (
    <div className="mb-3 space-y-1.5">
      {labels.map((label, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-medium text-muted"
        >
          <Feather className="h-3.5 w-3.5 shrink-0 text-accent" />
          {label}
        </div>
      ))}
    </div>
  );
}

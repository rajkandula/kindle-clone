"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AArrowDown,
  AArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Highlighter,
  Loader2,
  PanelLeft,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  X,
} from "lucide-react";

interface ReaderChapter {
  index: number;
  title: string;
  content: string;
}

interface ReaderBook {
  id: string;
  title: string;
  authorName: string;
}

export interface ReaderHighlight {
  id: string;
  chapterIndex: number;
  text: string;
  start: number;
  color: string;
}

const FONT_SIZES = [0.95, 1.05, 1.16, 1.3, 1.48];

const TTS_RATES = [0.8, 1, 1.2, 1.5];

/** Markdown → listenable plain text. */
function markdownToSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\*{3,}\s*$/gm, " ")
    .replace(/^\s*-{3,}\s*$/gm, " ")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The chapter's rendered text, with whitespace collapsed, plus a map back to
 * raw offsets. Used to locate a spoken sentence inside the DOM so it can be
 * highlighted while it's read.
 */
function normalizedIndex(root: Node): { norm: string; map: number[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let raw = "";
  while (walker.nextNode()) raw += (walker.currentNode as Text).data;

  let norm = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      norm += " ";
      map.push(i);
      prevSpace = true;
    } else {
      norm += ch;
      map.push(i);
      prevSpace = false;
    }
  }
  return { norm, map };
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Split text into utterance-sized pieces (long utterances stall in Chrome). */
function toSpeechChunks(text: string): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+["”')\]]*\s*|[^.!?…]+$/g) ?? [text];
  const chunks: string[] = [];
  for (const s of sentences) {
    let piece = s.trim();
    while (piece.length > 280) {
      const cut =
        Math.max(piece.lastIndexOf(", ", 260), piece.lastIndexOf(" ", 260)) || 260;
      chunks.push(piece.slice(0, cut + 1).trim());
      piece = piece.slice(cut + 1).trim();
    }
    if (piece) chunks.push(piece);
  }
  return chunks.filter(Boolean);
}

const HL_COLORS: { name: string; swatch: string }[] = [
  { name: "amber", swatch: "#fde047" },
  { name: "green", swatch: "#86efac" },
  { name: "rose", swatch: "#f9a8d4" },
  { name: "blue", swatch: "#93c5fd" },
];

/* ---------------- text-offset helpers (raw text-node coordinates) ---------------- */

function offsetWithin(root: Node, node: Node, nodeOffset: number): number {
  const r = document.createRange();
  r.selectNodeContents(root);
  try {
    r.setEnd(node, nodeOffset);
  } catch {
    return -1;
  }
  return r.toString().length;
}

function rangeFromOffsets(root: Node, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let startSet = false;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const next = pos + node.length;
    if (!startSet && start <= next) {
      range.setStart(node, Math.max(0, start - pos));
      startSet = true;
    }
    if (startSet && end <= next) {
      range.setEnd(node, Math.max(0, end - pos));
      return range;
    }
    pos = next;
  }
  return null;
}

function fullTextOf(root: Node): string {
  const r = document.createRange();
  r.selectNodeContents(root);
  return r.toString();
}

interface ToolbarState {
  x: number;
  y: number;
  mode: "create" | "existing";
  /** create mode */
  pending?: { text: string; start: number };
  /** existing mode */
  highlightId?: string;
}

/* ------------------------------------------------------------------ */

export function ReaderView({
  book,
  chapters,
  initialChapter,
  initialOffset,
  initialHighlights,
  initialReadChapters = [],
}: {
  book: ReaderBook;
  chapters: ReaderChapter[];
  initialChapter: number;
  initialOffset: number;
  initialHighlights: ReaderHighlight[];
  /** Chapters the user has already finished reading. */
  initialReadChapters?: number[];
}) {
  const [current, setCurrent] = useState(initialChapter);
  const [readChapters, setReadChapters] = useState<Set<number>>(
    () => new Set(initialReadChapters)
  );
  const [fontIdx, setFontIdx] = useState(2);
  const [tocOpen, setTocOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>(initialHighlights);
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  /* -------------------- listen (text-to-speech) -------------------- */

  const [tts, setTts] = useState<"idle" | "playing" | "paused">("idle");
  const [ttsOpen, setTtsOpen] = useState(false);
  const [ttsRate, setTtsRate] = useState(1);
  const ttsChunksRef = useRef<string[]>([]);
  const ttsIndexRef = useRef(0);
  /** Sentence currently being spoken — painted so the eye can follow. */
  const [spokenLine, setSpokenLine] = useState("");
  const ttsStateRef = useRef<"idle" | "playing" | "paused">("idle");
  const ttsRateRef = useRef(1);
  // Decided after mount — SSR and first client paint must match (hydration)
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    setTtsSupported("speechSynthesis" in window);
  }, []);

  const setTtsState = (s: "idle" | "playing" | "paused") => {
    ttsStateRef.current = s;
    setTts(s);
  };

  const speakFrom = useCallback((idx: number) => {
    const chunks = ttsChunksRef.current;
    if (idx >= chunks.length) {
      setTtsState("idle");
      return;
    }
    ttsIndexRef.current = idx;
    setSpokenLine(chunks[idx]);
    const u = new SpeechSynthesisUtterance(chunks[idx]);
    u.rate = ttsRateRef.current;
    // No voice set → the system's own default. Never the novelty voices
    // (Bells, Boing, Bad News…) that a picker would expose.
    u.onend = () => {
      if (ttsStateRef.current === "playing") speakFrom(idx + 1);
    };
    u.onerror = () => {
      if (ttsStateRef.current !== "idle") setTtsState("idle");
    };
    window.speechSynthesis.speak(u);
  }, []);

  const stopListening = useCallback(() => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    ttsIndexRef.current = 0;
    setTtsState("idle");
  }, [ttsSupported]);

  /* Restart speech at the new speed/voice without losing the place. */
  function changeTtsRate(rate: number) {
    setTtsRate(rate);
    ttsRateRef.current = rate;
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (ttsStateRef.current === "playing") {
      window.speechSynthesis.cancel();
      speakFrom(ttsIndexRef.current);
    }
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* ------------- HD narration (Kokoro, server-rendered, cached in storage) ------------- */

  interface HdManifest {
    status: "none" | "preparing" | "ready" | "error";
    parts?: number;
    totalParts?: number;
    urls?: string[];
    voice?: string;
    error?: string;
  }
  /** The narrators offered by the Chanova Audio service. */
  const HD_VOICES = [
    { id: "af_heart", label: "Heart — warm (US)" },
    { id: "af_bella", label: "Bella — expressive (US)" },
    { id: "af_nicole", label: "Nicole — soft (US)" },
    { id: "bf_emma", label: "Emma (UK)" },
    { id: "am_fenrir", label: "Fenrir (US, male)" },
  ];
  const VOICE_STORAGE_KEY = "lectoire.narrator";

  const [hd, setHd] = useState<HdManifest>({ status: "none" });
  const [hdVoice, setHdVoice] = useState("af_heart");
  const [hdPlaying, setHdPlaying] = useState(false);
  /**
   * Which chapter+voice the loaded status describes. Derived rather than reset
   * in an effect, so changing chapter or narrator makes the status "unknown"
   * in the same render — never briefly "there is no narration".
   */
  const [hdLoadedKey, setHdLoadedKey] = useState("");
  const [checkingHd, setCheckingHd] = useState(false);
  const [hdStarting, setHdStarting] = useState(false);
  const voiceName =
    HD_VOICES.find((v) => v.id === hdVoice)?.label.split(" —")[0].split(" (")[0] ??
    "the narrator";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hdPartRef = useRef(0);
  const hdWaitingRef = useRef(false);
  /** True from pressing play on an un-narrated chapter until part 0 arrives. */
  const hdStartingRef = useRef(false);
  const hdRef = useRef<HdManifest>({ status: "none" });

  /**
   * A listening session that outlives a single chapter.
   *
   * `listening` stays true from the moment you press play until you stop, so
   * when a chapter's last part ends we move to the next one and keep reading —
   * an audiobook, not ten separate clips.
   */
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  listeningRef.current = listening;
  /** Set while we're crossing into the next chapter and should resume there. */
  const resumeOnArrivalRef = useRef(false);
  /** Latest values for callbacks captured when the <audio> element was made. */
  const currentRef = useRef(current);
  currentRef.current = current;
  const chapterCountRef = useRef(chapters.length);
  chapterCountRef.current = chapters.length;
  const goToRef = useRef<(i: number) => void>(() => {});

  /* Remember the reader's chosen narrator across books and sessions. */
  useEffect(() => {
    const saved = window.localStorage.getItem(VOICE_STORAGE_KEY);
    if (saved && HD_VOICES.some((v) => v.id === saved)) setHdVoice(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeVoice(id: string) {
    if (id === hdVoice) return;
    audioRef.current?.pause();
    hdWaitingRef.current = false;
    hdStartingRef.current = false;
    setHdStarting(false);
    hdPartRef.current = 0;
    setHdPlaying(false);
    setSpokenLine("");
    stopListening();
    hdRef.current = { status: "none" };
    setHd({ status: "none" });
    setHdVoice(id);
    window.localStorage.setItem(VOICE_STORAGE_KEY, id);
  }

  const fetchHd = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${book.id}/audio/${current}?voice=${hdVoice}`);
      if (!res.ok) return;
      const data = (await res.json()) as HdManifest;
      hdRef.current = data;
      setHd(data);
      setHdLoadedKey(`${book.id}:${current}:${hdVoice}`);
      // We asked for this narration and the opening part has arrived — begin.
      // The rest of the chapter renders while it plays; synthesis runs faster
      // than playback, so the buffer only grows from here.
      if (hdStartingRef.current && (data.urls?.length ?? 0) > 0) {
        hdStartingRef.current = false;
        setHdStarting(false);
        hdPartRef.current = 0;
        playHdPart(0);
        return;
      }
      // A new part landed while we were waiting at the end of the last one
      if (
        hdWaitingRef.current &&
        (data.urls?.length ?? 0) > hdPartRef.current + 1
      ) {
        hdWaitingRef.current = false;
        playHdPart(hdPartRef.current + 1);
      }
    } catch {
      /* transient */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, current, hdVoice]);

  /* Load status when the panel opens or the chapter changes; poll while rendering. */
  useEffect(() => {
  }, [current, hdVoice]);

  useEffect(() => {
    if (!ttsOpen && !listening) return;
    void fetchHd();
    const t = setInterval(() => {
      if (
        hdRef.current.status === "preparing" ||
        hdWaitingRef.current ||
        hdStartingRef.current
      )
        void fetchHd();
    }, 2500);
    return () => clearInterval(t);
  }, [ttsOpen, listening, current, fetchHd]);

  /* Arrived at the next chapter mid-session — start it as soon as we know
     whether it has narration, so the book reads on without a gap. */
  useEffect(() => {
    // `hdLoaded` is declared below, so recompute the same check here.
    const known = hdLoadedKey === `${book.id}:${current}:${hdVoice}`;
    if (!resumeOnArrivalRef.current || !known) return;
    resumeOnArrivalRef.current = false;
    if ((hdRef.current.urls?.length ?? 0) > 0) {
      hdPartRef.current = 0;
      playHdPart(0);
    } else {
      // Not narrated yet — start it and keep the session alive. Listening
      // straight through a book is the whole point; stopping dead at the first
      // chapter nobody has heard before defeats it.
      void startNarration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hdLoadedKey, current]);

  function playHdPart(i: number) {
    const urls = hdRef.current.urls ?? [];
    if (i >= urls.length) return;
    hdPartRef.current = i;
    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      el.ontimeupdate = () => {
        const d = el!.duration;
        if (!d || !isFinite(d)) return;
        const line = sentenceAtPlayhead(hdPartRef.current, el!.currentTime / d);
        if (line) setSpokenLine(line);
      };
      el.onended = () => {
        const all = hdRef.current.urls ?? [];
        const next = hdPartRef.current + 1;
        if (next < all.length) {
          playHdPart(next);
          return;
        }
        if (hdRef.current.status === "preparing") {
          hdWaitingRef.current = true;
          return;
        }
        // Chapter finished. Roll straight into the next one.
        const nextChapter = currentRef.current + 1;
        if (listeningRef.current && nextChapter <= chapterCountRef.current) {
          resumeOnArrivalRef.current = true;
          goToRef.current(nextChapter);
        } else {
          setHdPlaying(false);
          setListening(false);
          setSpokenLine("");
        }
      };
      audioRef.current = el;
    }
    el.src = urls[i];
    el.playbackRate = ttsRateRef.current;
    void el.play();
    setHdPlaying(true);
  }

  /**
   * Follow-along highlighting for the narrated audio.
   *
   * The service renders each chapter in ~1400-character parts, so a part's
   * playback position maps proportionally onto its slice of the text — good
   * enough to keep the highlighted sentence in step with the voice.
   */
  function sentenceAtPlayhead(partIndex: number, fraction: number): string {
    const chunks = ttsChunksRef.current;
    if (chunks.length === 0) return "";
    const totalParts = Math.max(1, hdRef.current.totalParts ?? 1);
    // Distribute sentences evenly across parts, then walk within the part
    const perPart = chunks.length / totalParts;
    const idx = Math.floor(perPart * (partIndex + Math.min(1, Math.max(0, fraction))));
    return chunks[Math.min(chunks.length - 1, Math.max(0, idx))] ?? "";
  }

  /* Play always means "the narrator you chose". If that voice hasn't been
     rendered for this chapter yet we wait for it and start automatically —
     the device voice is offered as an explicit choice, never a surprise. */
  const playingAnything = hdPlaying;
  /** True once we know whether this exact chapter+voice has narration. */
  const hdLoaded = hdLoadedKey === `${book.id}:${current}:${hdVoice}`;

  /**
   * Ask for narration of this chapter and start playing the moment the opening
   * part lands.
   *
   * A whole book is far too much audio to render up front, and any edit to the
   * text invalidates it anyway — so chapters are narrated when somebody
   * actually wants to hear them. The service returns a short first part, so
   * this is a few seconds, not a chapter.
   */
  async function startNarration() {
    if (hdStartingRef.current) return;
    hdStartingRef.current = true;
    setHdStarting(true);
    stopListening();
    setListening(true);
    try {
      const res = await fetch(`/api/books/${book.id}/audio/${current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: hdVoice }),
      });
      if (!res.ok) throw new Error("could not start narration");
      const data = (await res.json()) as HdManifest;
      hdRef.current = data;
      setHd(data);
      setHdLoadedKey(`${book.id}:${current}:${hdVoice}`);
      if ((data.urls?.length ?? 0) > 0) {
        hdStartingRef.current = false;
        setHdStarting(false);
        hdPartRef.current = 0;
        playHdPart(0);
      }
      // Otherwise the poll loop above picks it up as soon as part 0 exists.
    } catch {
      hdStartingRef.current = false;
      setHdStarting(false);
      setListening(false);
    }
  }

  async function playNow() {
    if ((hdRef.current.urls?.length ?? 0) > 0) {
      stopListening();
      setListening(true);
      playHdPart(hdPartRef.current);
      return;
    }
    // The status request may still be in flight — pressing play the instant the
    // panel opens must not be mistaken for "this chapter has no narration".
    if (!hdLoaded) {
      setCheckingHd(true);
      await fetchHd();
      setCheckingHd(false);
      if ((hdRef.current.urls?.length ?? 0) > 0) {
        stopListening();
        setListening(true);
        playHdPart(hdPartRef.current);
        return;
      }
    }
    // Nothing rendered for this chapter yet — commission it.
    await startNarration();
  }

  function pauseNow() {
    setSpokenLine("");
    audioRef.current?.pause();
    hdWaitingRef.current = false;
    setHdPlaying(false);
    setListening(false);
  }

  function stopNow() {
    setSpokenLine("");
    audioRef.current?.pause();
    hdWaitingRef.current = false;
    hdPartRef.current = 0;
    setHdPlaying(false);
    setListening(false);
    stopListening();
  }

  /** Jump a chapter without leaving the audiobook — keeps playing on arrival. */
  function skipChapter(delta: number) {
    const target = current + delta;
    if (target < 1 || target > chapters.length) return;
    audioRef.current?.pause();
    hdWaitingRef.current = false;
    resumeOnArrivalRef.current = true;
    setListening(true);
    goTo(target);
  }

  /* Stop HD audio on chapter change / unmount. */
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);
  useEffect(() => {
    audioRef.current?.pause();
    hdWaitingRef.current = false;
    hdPartRef.current = 0;
    setHdPlaying(false);
    setSpokenLine("");
    hdRef.current = { status: "none" };
    setHd({ status: "none" });
  }, [current]);

  const chapter = useMemo(
    () => chapters.find((c) => c.index === current) ?? chapters[0],
    [chapters, current]
  );

  /* The chapter's sentences: spoken one at a time by the device voice, and
     used to follow along with the narrated audio. */
  useEffect(() => {
    ttsChunksRef.current = toSpeechChunks(
      `${chapter.title}. ${markdownToSpeech(chapter.content)}`
    );
    ttsIndexRef.current = 0;
  }, [chapter]);

  /* Contents panel: open by default on wide screens, slide-over on mobile. */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    setTocOpen(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* Restore saved scroll position once, after first paint. */
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const el = scrollRef.current;
    if (el && initialOffset > 0) {
      requestAnimationFrame(() => {
        el.scrollTop = initialOffset * (el.scrollHeight - el.clientHeight);
      });
    }
  }, [initialOffset]);

  /* -------------------- progress save -------------------- */

  const saveProgress = useCallback(
    (chapterIndex: number, offset: number, read: Set<number>) => {
      const key = `${chapterIndex}:${offset.toFixed(2)}:${read.size}`;
      if (key === lastSaved.current) return;
      lastSaved.current = key;
      void fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          chapterIndex,
          offset,
          chaptersRead: [...read],
        }),
        keepalive: true,
      });
    },
    [book.id]
  );

  /** Reaching the end of a chapter marks it read (jumping ahead doesn't). */
  const markRead = useCallback(
    (chapterIndex: number, offset: number) => {
      let read = readChapters;
      if (offset >= 0.95 && !read.has(chapterIndex)) {
        read = new Set(read).add(chapterIndex);
        setReadChapters(read);
      }
      return read;
    },
    [readChapters]
  );

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    setScrollPct(maxScroll > 0 ? el.scrollTop / maxScroll : 1);
    setToolbar(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const max = el.scrollHeight - el.clientHeight;
      const offset = max > 0 ? el.scrollTop / max : 1;
      const read = markRead(current, offset);
      saveProgress(current, offset, read);
    }, 800);
  }

  function goTo(index: number) {
    stopListening();
    if (!resumeOnArrivalRef.current) {
      // A deliberate jump ends the session — nobody wants chapter 2's audio
      // narrating over chapter 7's page.
      audioRef.current?.pause();
      hdWaitingRef.current = false;
      hdPartRef.current = 0;
      setHdPlaying(false);
      setListening(false);
      setSpokenLine("");
    }
    const clamped = Math.min(Math.max(index, 1), chapters.length);
    setCurrent(clamped);
    if (!isDesktop) setTocOpen(false);
    setScrollPct(0);
    setToolbar(null);
    scrollRef.current?.scrollTo({ top: 0 });
    saveProgress(clamped, 0, readChapters);
  }

  goToRef.current = goTo;

  /* A chapter short enough to fit the viewport counts as read on arrival. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      if (el.scrollHeight <= el.clientHeight + 4) {
        const read = markRead(current, 1);
        saveProgress(current, 1, read);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [current, markRead, saveProgress]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /* -------------------- highlight painting -------------------- */

  useEffect(() => {
    // CSS Custom Highlight API — paints ranges without touching the DOM
    const cssAny = typeof CSS !== "undefined" ? (CSS as unknown as { highlights?: Map<string, unknown> }) : null;
    const HighlightCtor = (globalThis as Record<string, unknown>).Highlight as
      | (new (...ranges: Range[]) => unknown)
      | undefined;
    if (!cssAny?.highlights || !HighlightCtor) return;
    const root = proseRef.current;
    if (!root) return;

    const byColor = new Map<string, Range[]>();
    const chapterHighlights = highlights.filter((h) => h.chapterIndex === current);
    let full: string | null = null;
    for (const h of chapterHighlights) {
      let range = rangeFromOffsets(root, h.start, h.start + h.text.length);
      if (!range || range.toString() !== h.text) {
        full ??= fullTextOf(root);
        const idx = full.indexOf(h.text);
        range =
          idx >= 0 ? rangeFromOffsets(root, idx, idx + h.text.length) : null;
      }
      if (range) {
        const list = byColor.get(h.color) ?? [];
        list.push(range);
        byColor.set(h.color, list);
      }
    }
    for (const { name } of HL_COLORS) {
      cssAny.highlights.set(
        `ember-${name}`,
        new HighlightCtor(...(byColor.get(name) ?? []))
      );
    }
    return () => {
      for (const { name } of HL_COLORS) cssAny.highlights!.delete(`ember-${name}`);
    };
  }, [highlights, current, chapter.content]);

  /* -------------------- follow-along highlight -------------------- */

  useEffect(() => {
    const cssAny =
      typeof CSS !== "undefined"
        ? (CSS as unknown as { highlights?: Map<string, unknown> })
        : null;
    const HighlightCtor = (globalThis as Record<string, unknown>).Highlight as
      | (new (...ranges: Range[]) => unknown)
      | undefined;
    if (!cssAny?.highlights || !HighlightCtor) return;

    const root = proseRef.current;
    const line = collapse(spokenLine);
    if (!root || line.length < 4) {
      cssAny.highlights.delete("ember-reading");
      return;
    }

    const { norm, map } = normalizedIndex(root);
    // Match on a distinctive slice — the tail of a sentence can be re-chunked
    const needle = line.slice(0, 120);
    let at = norm.indexOf(needle);
    if (at === -1) at = norm.indexOf(needle.slice(0, 60));
    if (at === -1) {
      cssAny.highlights.delete("ember-reading");
      return;
    }
    const endNorm = Math.min(norm.length, at + line.length) - 1;
    const range = rangeFromOffsets(root, map[at], map[endNorm] + 1);
    if (!range) {
      cssAny.highlights.delete("ember-reading");
      return;
    }
    cssAny.highlights.set("ember-reading", new HighlightCtor(range));

    // Keep the spoken line comfortably in view
    const box = range.getBoundingClientRect();
    const view = scrollRef.current?.getBoundingClientRect();
    if (view && (box.top < view.top + 80 || box.bottom > view.bottom - 80)) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTo({
          top: el.scrollTop + (box.top - view.top) - view.height / 2,
          behavior: "smooth",
        });
      }
    }
  }, [spokenLine, current]);

  /* -------------------- selection → toolbar -------------------- */

  function handlePointerUp(e: React.PointerEvent) {
    // let the browser finalize the selection first
    setTimeout(() => {
      const root = proseRef.current;
      if (!root) return;
      const sel = window.getSelection();

      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (
          !root.contains(range.startContainer) ||
          !root.contains(range.endContainer)
        ) {
          setToolbar(null);
          return;
        }
        const text = range.toString();
        if (!text.trim() || text.length > 1200) {
          setToolbar(null);
          return;
        }
        const start = offsetWithin(root, range.startContainer, range.startOffset);
        if (start < 0) return;
        const rect = range.getBoundingClientRect();
        setToolbar({
          x: rect.left + rect.width / 2,
          y: rect.top,
          mode: "create",
          pending: { text, start },
        });
        return;
      }

      // Collapsed click — did it land on an existing highlight?
      const doc = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (
          x: number,
          y: number
        ) => { offsetNode: Node; offset: number } | null;
      };
      let node: Node | null = null;
      let nodeOffset = 0;
      if (doc.caretRangeFromPoint) {
        const r = doc.caretRangeFromPoint(e.clientX, e.clientY);
        if (r) {
          node = r.startContainer;
          nodeOffset = r.startOffset;
        }
      } else if (doc.caretPositionFromPoint) {
        const p = doc.caretPositionFromPoint(e.clientX, e.clientY);
        if (p) {
          node = p.offsetNode;
          nodeOffset = p.offset;
        }
      }
      if (node && root.contains(node)) {
        const off = offsetWithin(root, node, nodeOffset);
        const hit = highlights.find(
          (h) =>
            h.chapterIndex === current &&
            off >= h.start &&
            off <= h.start + h.text.length
        );
        if (hit) {
          setToolbar({ x: e.clientX, y: e.clientY - 8, mode: "existing", highlightId: hit.id });
          return;
        }
      }
      setToolbar(null);
    }, 0);
  }

  /* -------------------- highlight actions -------------------- */

  async function createHighlight(color: string) {
    if (!toolbar?.pending) return;
    const { text, start } = toolbar.pending;
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
    const res = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: book.id, chapterIndex: current, text, start, color }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.highlight) {
      setHighlights((hs) =>
        [...hs, data.highlight as ReaderHighlight].sort(
          (a, b) => a.chapterIndex - b.chapterIndex || a.start - b.start
        )
      );
    }
  }

  async function recolorHighlight(id: string, color: string) {
    setToolbar(null);
    setHighlights((hs) => hs.map((h) => (h.id === id ? { ...h, color } : h)));
    await fetch(`/api/highlights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
  }

  async function removeHighlight(id: string) {
    setToolbar(null);
    setHighlights((hs) => hs.filter((h) => h.id !== id));
    await fetch(`/api/highlights/${id}`, { method: "DELETE" });
  }

  /* ------------------------------------------------------------------ */

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#faf8f4]">
      {/* Top bar */}
      {/* relative z-50: the body below is positioned, so without this the
          header's popovers render underneath it and can't be clicked. */}
      <header className="relative z-50 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-1">
          <button
            onClick={() => setTocOpen((o) => !o)}
            title="Contents"
            aria-label="Table of contents"
            className={`rounded-lg p-2 transition-colors hover:bg-raised hover:text-ink ${
              tocOpen ? "bg-raised text-ink" : "text-muted"
            }`}
          >
            {tocOpen && !isDesktop ? (
              <X className="h-4.5 w-4.5" />
            ) : (
              <PanelLeft className="h-4.5 w-4.5" />
            )}
          </button>
          <Link
            href={`/store/${book.id}`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="max-w-40 truncate sm:max-w-72">{book.title}</span>
          </Link>
        </div>

        <p className="hidden text-xs text-faint md:block">
          Chapter {current} of {chapters.length}
        </p>

        <div className="relative flex items-center gap-1">
          {ttsSupported && (
            <button
              onClick={() => setTtsOpen((o) => !o)}
              title="Listen to this book"
              aria-label="Listen to this book"
              className={`rounded-lg p-2 transition-colors hover:bg-raised hover:text-ink ${
                tts !== "idle" || ttsOpen ? "bg-accent-soft text-accent-deep" : "text-muted"
              }`}
            >
              <Headphones className="h-4.5 w-4.5" />
            </button>
          )}
          <button
            onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
            disabled={fontIdx === 0}
            title="Smaller text"
            aria-label="Smaller text"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            <AArrowDown className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
            disabled={fontIdx === FONT_SIZES.length - 1}
            title="Larger text"
            aria-label="Larger text"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            <AArrowUp className="h-4.5 w-4.5" />
          </button>

          {/* Listen panel */}
          {ttsOpen && (
            <div className="absolute top-11 right-0 z-50 w-72 rounded-2xl border border-line bg-surface p-4 shadow-book">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Listen · Chapter {current}</p>
                <button
                  onClick={() => setTtsOpen(false)}
                  aria-label="Close listen panel"
                  className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-raised hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mb-2 flex items-center justify-center gap-2.5">
                <button
                  onClick={() => skipChapter(-1)}
                  disabled={current <= 1}
                  aria-label="Previous chapter"
                  title="Previous chapter"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-paper text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <SkipBack className="h-3.5 w-3.5 fill-current" />
                </button>
                {playingAnything ? (
                  <button
                    onClick={pauseNow}
                    aria-label="Pause"
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-accent text-white shadow-book-sm transition-colors hover:bg-accent-deep"
                  >
                    <Pause className="h-5 w-5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={playNow}
                    aria-label="Play"
                    disabled={checkingHd || hdStarting}
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-accent text-white shadow-book-sm transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {checkingHd || hdStarting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => skipChapter(1)}
                  disabled={current >= chapters.length}
                  aria-label="Next chapter"
                  title="Next chapter"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-paper text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <SkipForward className="h-3.5 w-3.5 fill-current" />
                </button>
              </div>

              {/* Narration status */}
              <p className="mb-3 text-center text-[11px] text-faint">
                {checkingHd || !hdLoaded
                  ? "Checking for narration…"
                  : hdStarting
                    ? `${voiceName} is warming up — audio starts in a few seconds`
                    : hd.status === "ready"
                      ? `Narrated by ${voiceName}`
                      : hd.status === "preparing"
                        ? `${voiceName} is reading ahead${
                            hd.totalParts ? ` (${hd.parts ?? 0}/${hd.totalParts})` : "…"
                          }`
                        : `Press play and ${voiceName} starts reading`}
              </p>

              {hdPlaying && (
                <p className="-mt-2 mb-3 text-center text-[11px] text-faint">
                  Chapter {current} of {chapters.length} · plays on to the end of the book
                </p>
              )}

              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
                Narrator
              </p>
              <select
                value={hdVoice}
                onChange={(e) => changeVoice(e.target.value)}
                aria-label="Narrator voice"
                className="mb-3 w-full cursor-pointer rounded-lg border border-line bg-paper px-2.5 py-2 text-xs outline-none focus:border-accent"
              >
                {HD_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>

              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
                Speed
              </p>
              <div className="mb-3 flex gap-1.5">
                {TTS_RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => changeTtsRate(r)}
                    className={`flex-1 cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                      ttsRate === r
                        ? "border-accent bg-accent-soft text-accent-deep"
                        : "border-line bg-paper text-muted hover:text-ink"
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>

              <p className="text-[11px] leading-relaxed text-faint">
                Press play once and Lectoire reads the whole book, moving from
                chapter to chapter on its own. Every voice is a real narrator,
                never a synthetic device voice.
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Reading progress */}
      <div className="h-0.5 w-full bg-line">
        <div
          className="h-full bg-accent transition-[width] duration-150"
          style={{ width: `${Math.round(scrollPct * 100)}%` }}
        />
      </div>

      {/* Body: contents sidebar + page */}
      <div className="relative flex flex-1 overflow-hidden">
        {tocOpen && !isDesktop && (
          <button
            aria-label="Close contents"
            onClick={() => setTocOpen(false)}
            className="absolute inset-0 z-20 bg-ink/25"
          />
        )}

        {/* Contents sidebar */}
        {tocOpen && (
          <nav
            className={`z-30 flex w-72 shrink-0 flex-col border-r border-line bg-surface ${
              isDesktop ? "" : "absolute inset-y-0 left-0 shadow-pop"
            }`}
          >
            <div className="border-b border-line px-5 py-4">
              <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                Contents
              </p>
              <h2 className="font-display mt-1 line-clamp-2 text-[15px] leading-snug font-semibold">
                {book.title}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted">{book.authorName}</p>
            </div>
            <div className="flex-1 overflow-y-auto thin-scrollbar">
              {chapters.map((c) => {
                const isCurrent = c.index === current;
                const isRead = readChapters.has(c.index);
                return (
                  <button
                    key={c.index}
                    onClick={() => goTo(c.index)}
                    className={`flex w-full items-baseline gap-3 border-b border-line px-5 py-3 text-left text-[13.5px] transition-colors ${
                      isCurrent
                        ? "bg-accent-soft font-semibold text-accent-deep"
                        : "hover:bg-raised"
                    }`}
                  >
                    <span
                      className={`w-5 shrink-0 font-mono text-xs ${
                        isCurrent ? "text-accent-deep" : "text-faint"
                      }`}
                    >
                      {c.index}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{c.title}</span>
                    {isRead && <Check className="h-3.5 w-3.5 shrink-0 text-faint" />}
                  </button>
                );
              })}

              {highlights.length > 0 && (
                <div className="px-5 pt-4 pb-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">
                    <Highlighter className="h-3 w-3" /> Highlights ({highlights.length})
                  </p>
                </div>
              )}
              {highlights.map((h) => (
                <button
                  key={h.id}
                  onClick={() => goTo(h.chapterIndex)}
                  className="group flex w-full items-start gap-2.5 px-5 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: HL_COLORS.find((c) => c.name === h.color)?.swatch,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[12.5px] leading-snug text-muted italic">
                      “{h.text}”
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-faint">
                      Chapter {h.chapterIndex}
                    </span>
                  </span>
                </button>
              ))}
              <div className="h-4" />
            </div>
          </nav>
        )}

        {/* Page */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto thin-scrollbar"
        >
          <article
            className="mx-auto max-w-2xl px-6 py-12 sm:px-8"
            style={{ "--reader-size": `${FONT_SIZES[fontIdx]}rem` } as React.CSSProperties}
          >
            <p className="mb-2 text-center text-xs font-semibold tracking-[0.2em] text-faint uppercase">
              Chapter {chapter.index}
            </p>
            <h1 className="font-display mb-10 text-center text-3xl leading-tight font-semibold text-balance">
              {chapter.title}
            </h1>
            <div ref={proseRef} className="reading-prose" onPointerUp={handlePointerUp}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.content}</ReactMarkdown>
            </div>

            {/* Chapter nav footer */}
            <div className="mt-16 flex items-center justify-between border-t border-line pt-6">
              {current > 1 ? (
                <button
                  onClick={() => goTo(current - 1)}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-raised"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
              ) : (
                <span />
              )}
              {current < chapters.length ? (
                <button
                  onClick={() => goTo(current + 1)}
                  className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
                >
                  Next chapter <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    const read = markRead(current, 1);
                    saveProgress(current, 1, read);
                  }}
                  className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
                >
                  Finish book ✓
                </button>
              )}
            </div>
          </article>
        </div>
      </div>

      {/* Highlight toolbar */}
      {toolbar && (
        <div
          className="fade-up fixed z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 shadow-pop"
          style={{
            left: Math.min(Math.max(toolbar.x, 110), window.innerWidth - 110),
            top: Math.max(toolbar.y - 48, 8),
          }}
        >
          {HL_COLORS.map((c) => (
            <button
              key={c.name}
              title={`Highlight ${c.name}`}
              aria-label={`Highlight ${c.name}`}
              onClick={() =>
                toolbar.mode === "create"
                  ? createHighlight(c.name)
                  : recolorHighlight(toolbar.highlightId!, c.name)
              }
              className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110"
              style={{ background: c.swatch }}
            />
          ))}
          {toolbar.mode === "existing" && (
            <button
              title="Remove highlight"
              aria-label="Remove highlight"
              onClick={() => removeHighlight(toolbar.highlightId!)}
              className="ml-0.5 grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Book exports — builds a book in every format we ship in the download ZIP:
 * EPUB (real ebook), PDF, DOCX, standalone HTML, Markdown, and plain text.
 */
import JSZip from "jszip";
import sharp from "sharp";
import { marked } from "marked";
import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
} from "docx";

export interface ExportChapter {
  index: number;
  title: string;
  content: string; // markdown
}

export interface ExportBook {
  title: string;
  subtitle: string;
  authorName: string;
  description: string;
  genre: string;
  /** Uploaded cover image URL ("" → use the generated cover). */
  coverUrl?: string;
  coverStyle?: { palette: number; layout: number };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "book"
  );
}

/** Markdown → plain text (good enough for TXT/PDF/DOCX paragraphs). */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*\*$/gm, "* * *")
    .replace(/^\s*\*{3,}\s*$/gm, "* * *")
    .replace(/^\s*---+\s*$/gm, "* * *")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function mdToXhtml(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  // EPUB is XHTML, so every void element must be closed. Missing <img/> here
  // is fatal: readers refuse the whole chapter with a tag-mismatch error.
  return html
    .replace(/<hr\s*\/?>/g, "<hr/>")
    .replace(/<br\s*\/?>/g, "<br/>")
    .replace(/<img\b([^>]*?)\s*\/?>/g, "<img$1/>")
    .replace(/&nbsp;/g, "&#160;");
}

/* ------------------------------------------------------------------ */
/* Illustrations                                                       */
/* ------------------------------------------------------------------ */

export interface FetchedImage {
  /** The URL as it appears in the chapter markdown. */
  src: string;
  /** File name inside the export, e.g. "images/img-1.jpg". */
  path: string;
  id: string;
  mediaType: string;
  data: Buffer;
  width: number;
  height: number;
}

const IMG_MD = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

/**
 * Pull every illustration referenced by the book and convert it to JPEG.
 *
 * Exports have to stand alone: an EPUB read on a plane, a PDF opened years from
 * now. Remote URLs would leave holes in both, so the bytes travel with the file.
 * JPEG because it is the one format every e-reader and PDF viewer handles —
 * several choke on the WebP we store.
 */
export async function collectImages(chapters: ExportChapter[]): Promise<FetchedImage[]> {
  const urls = new Set<string>();
  for (const c of chapters) {
    for (const m of c.content.matchAll(IMG_MD)) urls.add(m[1]);
  }
  if (urls.size === 0) return [];

  const results = await Promise.all(
    [...urls].map(async (src, i) => {
      try {
        const res = await fetch(src);
        if (!res.ok) return null;
        const raw = Buffer.from(await res.arrayBuffer());
        const img = sharp(raw);
        const meta = await img.metadata();
        const data = await img
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        return {
          src,
          path: `images/img-${i + 1}.jpg`,
          id: `img${i + 1}`,
          mediaType: "image/jpeg",
          data,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
        } satisfies FetchedImage;
      } catch {
        // A book that loses one picture is better than an export that fails
        return null;
      }
    })
  );
  return results.filter((r): r is FetchedImage => r !== null);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A chapter split into things you can lay out: prose and pictures. */
export type Block =
  | { kind: "text"; text: string }
  | { kind: "image"; image: FetchedImage };

/**
 * Split chapter markdown into paragraphs and illustrations.
 *
 * Page formats can't flow an image inside a paragraph the way a browser does,
 * so a picture has to become its own block with the prose either side of it.
 */
export function blocksFor(content: string, images: FetchedImage[]): Block[] {
  const byUrl = new Map(images.map((i) => [i.src, i]));
  const blocks: Block[] = [];

  for (const chunk of content.split(/\n{2,}/)) {
    const piece = chunk.trim();
    if (!piece) continue;
    const single = piece.match(/^!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/);
    if (single && byUrl.has(single[1])) {
      blocks.push({ kind: "image", image: byUrl.get(single[1])! });
      continue;
    }
    // Any image left inline is dropped from the text rather than printed as
    // "!alt" — the picture itself is emitted separately if we fetched it.
    const withoutImages = piece.replace(IMG_MD, "").trim();
    if (!withoutImages) continue;
    const text = stripMarkdown(withoutImages).replace(/\n/g, " ").trim();
    if (text) blocks.push({ kind: "text", text });
  }
  return blocks;
}

/* ------------------------------------------------------------------ */
/* simple text formats                                                 */
/* ------------------------------------------------------------------ */

export function buildMarkdown(book: ExportBook, chapters: ExportChapter[]): string {
  const parts = [
    `# ${book.title}`,
    book.subtitle ? `*${book.subtitle}*` : "",
    `by ${book.authorName}`,
    "",
    book.description,
    "",
    "---",
    "",
  ];
  for (const ch of chapters) {
    parts.push(`## Chapter ${ch.index}: ${ch.title}`, "", ch.content, "");
  }
  return parts.filter((p) => p !== undefined).join("\n");
}

export function buildTxt(book: ExportBook, chapters: ExportChapter[]): string {
  const line = (s: string) => `${s}\n${"=".repeat(Math.min(s.length, 70))}`;
  const parts = [
    line(book.title.toUpperCase()),
    book.subtitle,
    `by ${book.authorName}`,
    "",
    stripMarkdown(book.description),
    "",
  ];
  for (const ch of chapters) {
    parts.push("", line(`CHAPTER ${ch.index}: ${ch.title}`), "", stripMarkdown(ch.content));
  }
  return parts.join("\n");
}

export function buildHtml(book: ExportBook, chapters: ExportChapter[]): string {
  const toc = chapters
    .map((c) => `<li><a href="#ch${c.index}">${escapeXml(c.title)}</a></li>`)
    .join("\n");
  const body = chapters
    .map(
      (c) => `<section id="ch${c.index}">
<p class="chapter-no">Chapter ${c.index}</p>
<h2>${escapeXml(c.title)}</h2>
${mdToXhtml(c.content)}
</section>`
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeXml(book.title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 42rem; margin: 0 auto;
         padding: 3rem 1.5rem; line-height: 1.8; color: #292524; background: #faf8f4; }
  h1 { font-size: 2.4rem; line-height: 1.2; margin: 0; }
  .subtitle { font-size: 1.2rem; color: #57534e; font-style: italic; }
  .byline { color: #b45309; font-weight: 600; margin-bottom: 2.5rem; }
  .description { color: #57534e; border-left: 3px solid #d9c9a8; padding-left: 1rem; }
  .chapter-no { text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.75rem;
                color: #a29d96; margin: 4rem 0 0.25rem; }
  h2 { font-size: 1.7rem; margin: 0 0 1.5rem; }
  hr { border: none; text-align: center; margin: 2em 0; }
  hr::after { content: "* * *"; color: #a29d96; letter-spacing: 0.4em; }
  nav ol { line-height: 2; }
  a { color: #b45309; }
</style>
</head>
<body>
<h1>${escapeXml(book.title)}</h1>
${book.subtitle ? `<p class="subtitle">${escapeXml(book.subtitle)}</p>` : ""}
<p class="byline">by ${escapeXml(book.authorName)}</p>
<p class="description">${escapeXml(book.description)}</p>
<nav><h2 style="font-size:1.2rem">Contents</h2><ol>${toc}</ol></nav>
${body}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* EPUB                                                                */
/* ------------------------------------------------------------------ */

export async function buildEpub(
  book: ExportBook,
  chapters: ExportChapter[],
  prefetched?: FetchedImage[]
): Promise<Buffer> {
  const zip = new JSZip();
  const uid = `lectoire-${slugify(book.title)}-${Date.now()}`;
  const images = prefetched ?? (await collectImages(chapters));
  for (const img of images) zip.file(`OEBPS/${img.path}`, img.data);

  /** Swap remote URLs for the copies packaged alongside the chapter. */
  const localise = (md: string) =>
    images.reduce((acc, img) => acc.split(img.src).join(img.path), md);

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  );

  const css = `body { font-family: serif; line-height: 1.7; margin: 0; padding: 0 0.25em; }
h1 { font-size: 1.6em; line-height: 1.25; }
.chapter-no { text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.7em; color: #888; }
hr { border: none; text-align: center; }
hr:after { content: "* * *"; letter-spacing: 0.4em; }
img { max-width: 100%; height: auto; display: block; margin: 1.2em auto; }
/* Title page: no % margins — paginated renderers (Apple Books) push
   oversized blocks into the next column and wreck the alignment. */
.titlepage { text-align: center; margin: 3em 0 0; }
.titlepage h1 { font-size: 2em; margin: 0 0 0.4em; }
.titlepage .subtitle { font-style: italic; font-size: 1.1em; margin: 0 0 2em; }
.titlepage .author { font-size: 1em; letter-spacing: 0.08em; }`;
  zip.file("OEBPS/style.css", css);

  const xhtmlDoc = (title: string, bodyHtml: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${bodyHtml}</body>
</html>`;

  // Title page
  zip.file(
    "OEBPS/titlepage.xhtml",
    xhtmlDoc(
      book.title,
      `<div class="titlepage">
<h1>${escapeXml(book.title)}</h1>
${book.subtitle ? `<p class="subtitle">${escapeXml(book.subtitle)}</p>` : ""}
<p class="author">${escapeXml(book.authorName)}</p>
</div>`
    )
  );

  // Chapters
  for (const ch of chapters) {
    zip.file(
      `OEBPS/chapter-${ch.index}.xhtml`,
      xhtmlDoc(
        ch.title,
        `<p class="chapter-no">Chapter ${ch.index}</p><h1>${escapeXml(ch.title)}</h1>${mdToXhtml(localise(ch.content))}`
      )
    );
  }

  // Nav
  const navList = chapters
    .map((c) => `<li><a href="chapter-${c.index}.xhtml">${escapeXml(c.title)}</a></li>`)
    .join("");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="titlepage.xhtml">Title</a></li>${navList}</ol></nav></body>
</html>`
  );

  const manifest = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>`,
    ...chapters.map(
      (c) =>
        `<item id="ch${c.index}" href="chapter-${c.index}.xhtml" media-type="application/xhtml+xml"/>`
    ),
    ...images.map(
      (img) => `<item id="${img.id}" href="${img.path}" media-type="${img.mediaType}"/>`
    ),
  ].join("\n    ");
  const spine = [
    `<itemref idref="titlepage"/>`,
    ...chapters.map((c) => `<itemref idref="ch${c.index}"/>`),
  ].join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${uid}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.authorName)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>${escapeXml(book.description)}</dc:description>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z/, "Z")}</meta>
  </metadata>
  <manifest>
    ${manifest}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) as Promise<Buffer>;
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

export function buildPdf(
  book: ExportBook,
  chapters: ExportChapter[],
  images: FetchedImage[] = []
): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 72, bottom: 72, left: 86, right: 86 },
      info: { Title: book.title, Author: book.authorName },
    });
    const buffers: Buffer[] = [];
    doc.on("data", (b: Buffer) => buffers.push(b));
    doc.on("end", () => resolvePdf(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Title page
    doc.moveDown(8);
    doc.font("Times-Bold").fontSize(30).text(book.title, { align: "center" });
    if (book.subtitle) {
      doc.moveDown(0.5);
      doc.font("Times-Italic").fontSize(15).text(book.subtitle, { align: "center" });
    }
    doc.moveDown(1.5);
    doc.font("Times-Roman").fontSize(13).text(book.authorName, { align: "center" });

    for (const ch of chapters) {
      doc.addPage();
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#888888")
        .text(`CHAPTER ${ch.index}`, { align: "center", characterSpacing: 2 });
      doc.moveDown(0.4);
      doc
        .font("Times-Bold")
        .fontSize(20)
        .fillColor("#000000")
        .text(ch.title, { align: "center" });
      doc.moveDown(1.5);
      doc.font("Times-Roman").fontSize(12).fillColor("#111111");
      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      for (const block of blocksFor(ch.content, images)) {
        if (block.kind === "image") {
          const { image } = block;
          const ratio = image.height && image.width ? image.height / image.width : 0.66;
          const drawWidth = usableWidth;
          const drawHeight = drawWidth * ratio;
          // Start a new page rather than letting a picture spill off this one
          const room = doc.page.height - doc.page.margins.bottom - doc.y;
          if (drawHeight > room) doc.addPage();
          doc.moveDown(0.4);
          doc.image(image.data, { fit: [drawWidth, drawHeight], align: "center" });
          doc.moveDown(0.8);
          continue;
        }
        if (block.text === "* * *") {
          doc.moveDown(0.5);
          doc.text("* * *", { align: "center" });
          doc.moveDown(0.5);
        } else {
          doc.text(block.text, { align: "justify", lineGap: 3.5 });
          doc.moveDown(0.6);
        }
      }
    }
    doc.end();
  });
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                */
/* ------------------------------------------------------------------ */

export function buildDocx(
  book: ExportBook,
  chapters: ExportChapter[],
  images: FetchedImage[] = []
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(book.title)],
    }),
  ];
  if (book.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: book.subtitle, italics: true, size: 28 })],
      })
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: `by ${book.authorName}`, size: 24 })],
    })
  );

  for (const ch of chapters) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun(`Chapter ${ch.index}: ${ch.title}`)],
      })
    );
    for (const block of blocksFor(ch.content, images)) {
      if (block.kind === "image") {
        const { image } = block;
        // Word measures in points; 432pt ≈ 6in, the text width of a letter page
        const width = 432;
        const height = Math.round(
          width * (image.height && image.width ? image.height / image.width : 0.66)
        );
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new ImageRun({
                data: image.data,
                transformation: { width, height },
                type: "jpg",
              }),
            ],
          })
        );
        continue;
      }
      children.push(
        new Paragraph({
          alignment: block.text === "* * *" ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 340 },
          children: [new TextRun({ text: block.text, size: 24 })],
        })
      );
    }
  }

  const doc = new Document({
    creator: book.authorName,
    title: book.title,
    description: book.description,
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* the ZIP bundle                                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* cover image                                                         */
/* ------------------------------------------------------------------ */

import { COVER_PALETTES } from "./covers";

/** Greedy word-wrap for SVG title text. */
function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6);
}

/**
 * The generated cover as a standalone SVG — a faithful copy of the in-app
 * Cover component: same palette, same layout variant, same geometry.
 * (1200×1800; the app sizes in cqw where 1cqw = 12px here.)
 */
export function buildCoverSvg(book: ExportBook): string {
  const n = COVER_PALETTES.length;
  const idx = ((Math.round(book.coverStyle?.palette ?? 0) % n) + n) % n;
  const p = COVER_PALETTES[idx] ?? COVER_PALETTES[0];
  const layout = ((Math.round(book.coverStyle?.layout ?? 0) % 4) + 4) % 4;
  const W = 1200;
  const H = 1800;
  const cq = W / 100; // 1cqw in px
  const FONT = "Georgia, 'Times New Roman', serif";
  const author = book.authorName || "";
  const genre = (book.genre || "A novel").toUpperCase();

  const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  const tspans = (lines: string[], x: number, size: number, lh: number) =>
    lines
      .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * lh}">${escapeXml(l)}</tspan>`)
      .join("");

  /** Shrink the font until the longest line fits the usable width.
   *  0.62em/char approximates bold Georgia incl. wide capitals. */
  const fitFont = (lines: string[], base: number, usable: number, factor = 0.62) => {
    const longest = Math.max(1, ...lines.map((l) => l.length));
    return Math.min(base, Math.floor(usable / (longest * factor)));
  };

  let body = "";

  if (layout === 0) {
    // Centered: author, rule, big centered title, fleuron
    const lines = wrapWords(book.title, 15);
    const size = fitFont(lines, 10.5 * cq, W - 16 * cq);
    const blockH = size * 1.15 * (lines.length - 1);
    const titleY = H / 2 - blockH / 2;
    body = `
  <text x="${W / 2}" y="${11 * cq}" text-anchor="middle" fill="${p.fg}" opacity="0.8"
        font-family="${FONT}" font-size="${4.6 * cq}" letter-spacing="${0.18 * 4.6 * cq}">${escapeXml(author.toUpperCase())}</text>
  <rect x="${W / 2 - 13 * cq}" y="${15 * cq}" width="${26 * cq}" height="3" fill="${p.accent}" opacity="0.9"/>
  <text x="${W / 2}" y="${titleY}" text-anchor="middle" fill="${p.fg}" font-weight="600"
        font-family="${FONT}" font-size="${size}">${tspans(lines, W / 2, size, 1.15)}</text>
  <text x="${W / 2}" y="${H - 9 * cq}" text-anchor="middle" fill="${p.accent}"
        font-family="${FONT}" font-size="${7 * cq}">&#10086;</text>`;
  } else if (layout === 1) {
    // Genre top-left; accent band with the title near the bottom; author below
    const lines = wrapWords(book.title, 17);
    const size = fitFont(lines, 10 * cq, W - 16 * cq);
    const bandTextH = size * 1.12 * lines.length;
    const bandH = bandTextH + 12 * cq;
    const authorH = 15 * cq;
    const bandY = H - authorH - bandH;
    body = `
  <text x="${8 * cq}" y="${11 * cq}" fill="${p.fg}" opacity="0.75"
        font-family="${FONT}" font-size="${4.4 * cq}" letter-spacing="${0.2 * 4.4 * cq}">${escapeXml(genre)}</text>
  <rect x="0" y="${bandY}" width="${W}" height="${bandH}" fill="${p.accent}"/>
  <text x="${8 * cq}" y="${bandY + 6 * cq + size * 0.85}" fill="${p.bg2}" font-weight="700"
        font-family="${FONT}" font-size="${size}">${tspans(lines, 8 * cq, size, 1.12)}</text>
  <text x="${8 * cq}" y="${H - 6 * cq}" fill="${p.fg}" font-weight="500"
        font-family="${FONT}" font-size="${5 * cq}" letter-spacing="2">${escapeXml(author)}</text>`;
  } else if (layout === 2) {
    // Big accent circle top-right + thin ring; title + author bottom-left
    const lines = wrapWords(book.title, 15);
    const size = fitFont(lines, 10.5 * cq, W - 16 * cq);
    const authorY = H - 8 * cq;
    const titleBlockH = size * 1.12 * (lines.length - 1);
    const titleY = authorY - 8 * cq - titleBlockH;
    body = `
  <circle cx="${W - 13 * cq}" cy="${17 * cq}" r="${35 * cq}" fill="${p.accent}" opacity="0.85"/>
  <circle cx="${W - 25 * cq}" cy="${51 * cq}" r="${17 * cq}" fill="none" stroke="${p.fg}" stroke-width="2.5" opacity="0.35"/>
  <text x="${8 * cq}" y="${titleY}" fill="${p.fg}" font-weight="600"
        font-family="${FONT}" font-size="${size}">${tspans(lines, 8 * cq, size, 1.12)}</text>
  <text x="${8 * cq}" y="${authorY}" fill="${p.fg}" opacity="0.8" font-weight="500"
        font-family="${FONT}" font-size="${5 * cq}">${escapeXml(author)}</text>`;
  } else {
    // Framed: border, genre with underline, centered title, accent author
    const lines = wrapWords(book.title, 16);
    const size = fitFont(lines, 9.5 * cq, W - 24 * cq);
    const blockH = size * 1.18 * (lines.length - 1);
    const titleY = H / 2 - blockH / 2;
    body = `
  <rect x="${5 * cq}" y="${5 * cq}" width="${W - 10 * cq}" height="${H - 10 * cq}"
        fill="none" stroke="${p.fg}" stroke-opacity="0.33" stroke-width="4"/>
  <text x="${W / 2}" y="${13 * cq}" text-anchor="middle" fill="${p.fg}" opacity="0.75"
        font-family="${FONT}" font-size="${4.2 * cq}" letter-spacing="${0.22 * 4.2 * cq}">${escapeXml(genre)}</text>
  <line x1="${W * 0.14}" y1="${16 * cq}" x2="${W * 0.86}" y2="${16 * cq}" stroke="${p.fg}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="${W / 2}" y="${titleY}" text-anchor="middle" fill="${p.fg}" font-weight="600"
        font-family="${FONT}" font-size="${size}">${tspans(lines, W / 2, size, 1.18)}</text>
  <text x="${W / 2}" y="${H - 10 * cq}" text-anchor="middle" fill="${p.accent}" font-weight="500"
        font-family="${FONT}" font-size="${4.6 * cq}" letter-spacing="${0.14 * 4.6 * cq}">${escapeXml(author.toUpperCase())}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg}${body}
</svg>`;
}

/** The cover as a ZIP entry: uploaded image bytes, or the generated SVG. */
async function coverZipEntry(
  book: ExportBook
): Promise<{ name: string; data: Buffer | string }> {
  if (book.coverUrl) {
    try {
      const res = await fetch(book.coverUrl);
      if (res.ok) {
        const type = res.headers.get("content-type") ?? "";
        const ext = type.includes("png")
          ? "png"
          : type.includes("webp")
            ? "webp"
            : type.includes("svg")
              ? "svg"
              : "jpg";
        return { name: `cover.${ext}`, data: Buffer.from(await res.arrayBuffer()) };
      }
    } catch {
      /* unreachable image — fall back to the generated cover */
    }
  }
  return { name: "cover.svg", data: buildCoverSvg(book) };
}

export async function buildDownloadZip(
  book: ExportBook,
  chapters: ExportChapter[]
): Promise<{ buffer: Buffer; filename: string }> {
  const slug = slugify(book.title);
  // Fetched once and shared: three formats need the same pictures, and an
  // illustrated book would otherwise download every image three times.
  const images = await collectImages(chapters);
  const [epub, pdf, docx, cover] = await Promise.all([
    buildEpub(book, chapters, images),
    buildPdf(book, chapters, images),
    buildDocx(book, chapters, images),
    coverZipEntry(book),
  ]);

  const zip = new JSZip();
  zip.file(cover.name, cover.data);
  zip.file(`${slug}.epub`, epub);
  zip.file(`${slug}.pdf`, pdf);
  zip.file(`${slug}.docx`, docx);
  zip.file(`${slug}.html`, buildHtml(book, chapters));
  zip.file(`${slug}.md`, buildMarkdown(book, chapters));
  zip.file(`${slug}.txt`, buildTxt(book, chapters));
  zip.file(
    "README.txt",
    `${book.title}
by ${book.authorName}

Exported from Lectoire.

Formats:
  ${slug}.epub  — ebook (Apple Books, Kobo, Kindle via import, etc.)
  ${slug}.pdf   — print-style layout
  ${slug}.docx  — Microsoft Word / Google Docs
  ${slug}.html  — open in any browser
  ${slug}.md    — Markdown source
  ${slug}.txt   — plain text
  ${cover.name}    — the book cover
`
  );

  const buffer = (await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  })) as Buffer;
  return { buffer, filename: `${slug}.zip` };
}

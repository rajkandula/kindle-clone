# Lectoire — read, explore, create books

A book platform in the spirit of Apple Books, plus an AI writing studio. One Next.js codebase serves the website and the API, and installs on phones, tablets and desktops as a progressive web app (PWA).

- **Home** — Continue reading, Current Bestsellers, New & Notable, free reads, community books
- **Book Store** — genre browsing, book pages with contents, similar titles, shelf actions
- **Library** — All / Reading Now / Want to Read / Finished / My Books
- **Reader** — serif reading experience, font size controls, chapter nav, highlights, auto-saved progress, narrated audiobooks
- **Studio** — chat with Claude, and it *holds the pen*: its tools (`set_book`, `write_chapter`, `edit_chapter`, `delete_chapter`, `read_chapter`, `generate_cover`, `edit_cover`, `generate_chapter_image`) write real chapters and artwork into your book while you watch it grow in a live preview. Publish to the store with one click.
- **Downloads** — every book exports as EPUB, PDF, DOCX, HTML, Markdown and plain text.
- **Lectoire Plus** — a monthly subscription (Stripe) for the Studio, the whole Lectoire Originals library and downloads.
- **Selling** — authors set a price and keep 70% of each sale after payment processing; earnings clear and pay out through Stripe Connect. The design is written up in [docs/creator-payouts.md](docs/creator-payouts.md).
- **Printed books** — readers can order a paperback; orders are fulfilled from the admin portal.
- **Claude connector** — manage your library by chatting with Claude (see [MCP](#mcp)).
- **Admin portal** — users, books, creators, revenue, subscriptions, orders and contact messages.

## Stack

| Layer | Choice |
| --- | --- |
| Web + API | Next.js 16 (App Router), React 19, Tailwind v4 |
| Text data | MongoDB via Mongoose (`users`, `books`, `chapters`, `libraryentries`, `conversations`, `messages`, …) |
| Media | Any S3-compatible bucket, presigned direct uploads (`/api/upload`) |
| AI | Anthropic API, streaming + tool use (`BOOK_MODEL`, default Haiku 4.5); optional xAI image generation for covers and chapter art |
| Narration | Optional external text-to-speech service (Chanova Audio API, see `lib/audiobook.ts`) |
| Payments | Stripe Checkout, subscriptions and Connect (optional) |
| Email | Harakumo Mail for team alerts (optional) |
| Auth | bcrypt + JWT (jose) in an httpOnly cookie |
| App | Installable PWA (`app/manifest.ts`, `public/sw.js`) — iPhone, Android, Mac, Windows |
| Covers | Generated SVG-style covers (12 palettes × 4 layouts, deterministic per title/genre) — no image assets needed; custom covers can be uploaded to the bucket |

## Run it

Requires Node.js 20.9 or later and a MongoDB database.

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI, AUTH_SECRET, ANTHROPIC_API_KEY (the rest is optional)
npm run generate:catalog     # optional: AI-writes the store catalog (real full books, byline "Lectoire Originals")
npm run dev
```

Open http://localhost:3000, create an account, and try the Studio.

For production: `npm run build`, then `npm start` (or `node .next/standalone/server.js`, which is what the `Dockerfile` runs). Set `NEXT_PUBLIC_ORIGIN` to your public URL before building.

To make yourself an admin, set `role: "admin"` on your user in the `users` collection; admins can then promote others from `/admin/users`.

## Installing the app

Lectoire is a PWA. `/install` walks through the steps per device,
`app/manifest.ts` declares it, `public/sw.js` is a caching-free service worker
(books and progress are live data — a stale shell would be worse than none),
and `components/InstallButton.tsx` drives the browser's own install prompt.

## How the Studio works

`POST /api/studio/chat` streams SSE. Each request:

1. Creates (or loads) a **Conversation + draft Book** pair.
2. Builds a system prompt containing the live book state (title, genre, chapter list with word counts).
3. Runs an agent loop (max 12 rounds): Claude streams prose to the chat, and calls tools that are executed server-side against MongoDB. Every mutation emits an `action` event (the feed in the chat) and a `book` snapshot event (the live preview panel).
4. Persists the assistant message + tool activity, syncs the conversation title to the book title.

Events: `meta`, `delta`, `status`, `action`, `book`, `title`, `error`, `done`.

## MCP

`/api/mcp` is a stateless Streamable-HTTP MCP server with 12 tools (list, create, get, update, publish, unpublish, browse and delete books; read, write, edit and delete chapters). Users manage their library by chatting in Claude Code, Claude Desktop or claude.ai — inference runs on *their* Claude subscription, not this app's key.

- **Claude Code / Claude Desktop:** generate a personal bearer token on `/connections`, then
  `claude mcp add --transport http lectoire <origin>/api/mcp -H "Authorization: Bearer emb_…"`.
- **claude.ai connectors:** add `<origin>/api/mcp` as a custom connector; it signs in through the built-in OAuth flow (`/oauth/authorize`, discovery under `/.well-known/`). Connected apps are listed, and can be disconnected, on `/connections`.

## Background work

Narrations, chapter drawings and creator payouts that a restart interrupts are picked up by a
housekeeping sweep (`lib/housekeeping.ts`). A production server runs it every 15 minutes on its
own (`HOUSEKEEPING_INTERVAL_MINUTES`, `0` turns it off). To drive it from an external scheduler
instead, call `POST /api/cron/narration` with `Authorization: Bearer $CRON_SECRET`. Every step is
safe to repeat.

## Run Lectoire on Harakumo

Lectoire is open source (MIT) and is published on [Nucleus](https://nucleus.harakumo.com/-/explore),
Harakumo's code home. Its team alerts already go through Harakumo Mail (`lib/harakumo.ts`, one
`HARAKUMO_API_KEY`).

Lectoire is a Node server (Next.js standalone output, long-running streamed AI responses, PDF and
EPUB rendering), so on Harakumo it runs as a **server app** (Pro plan and up), not a static site.

1. **Create a project** at [harakumo.com/dashboard](https://harakumo.com/dashboard) → Projects → New project.
2. **Create an API key** (Settings → API keys) and add it to the project's environment as
   `HARAKUMO_API_KEY` if you want email alerts (contact form, paid orders, disputes); set
   `ADMIN_EMAIL` or `CONTACT_EMAIL` to say where they go.
3. **Add the rest of the environment** (Project → Environment), from `.env.example`:
   - `MONGODB_URI` — a MongoDB database (include the database name in the path). **MongoDB is
     required for now.**
   - `AUTH_SECRET` — a long random string (`openssl rand -base64 32`).
   - `ANTHROPIC_API_KEY` — for the Studio.
   - `NEXT_PUBLIC_ORIGIN` — your app's public URL (used in invite links, the connector URL and
     payment return URLs).
   - Media storage: the S3-compatible `STORAGE_*` values (bucket, keys, endpoint, public URL).
     Uploads must go to object storage in production: a server app's disk is not kept between deploys.
   - Optional: `XAI_API_KEY` (cover and chapter art), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
     (Plus, book sales, print orders, payouts), `CHANOVA_AUDIO_URL` + `CHANOVA_AUDIO_KEY` (narration),
     `CRON_SECRET`, `CONTACT_EMAIL`.
4. **Deploy** from a folder with the CLI, or ask your AI assistant with the Harakumo connector:

   ```bash
   npm i -g @harakumo/cli
   harakumo login --key <your API key>
   harakumo deploy <project id> .
   ```

   Every deploy is saved as a commit in the project's private Nucleus repo.

Notes:

- **External services:** MongoDB and an Anthropic API key are needed for the core app. Stripe,
  xAI and the narration service are optional; without their keys those features report
  themselves as unavailable and the rest of the app works.
- **Stripe webhook:** point it at `<origin>/api/stripe/webhook` with the events
  `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`, `account.updated`,
  `customer.subscription.updated` and `customer.subscription.deleted`.
- **Your MongoDB must accept the server's connections**: allow its address range, and use a
  database user limited to this database with a long password.
- **Long requests:** a Studio turn streams for up to 300 seconds, so the server must not cut
  responses short.

## Notes

- Store catalog: `npm run generate:catalog` uses the Anthropic API to design and write complete books (outline → chapters with continuity), published under **Lectoire Originals** — no fake human authors. Re-running replaces only catalog books (`ownerId: null`), never user books. Edit the `SPECS` list in [scripts/generate-catalog.mjs](scripts/generate-catalog.mjs) to change genres/premises/count.
- Publishing requires ≥1 chapter and a description (ask the Studio to write one).
- `BOOK_MODEL=claude-sonnet-5` in `.env.local` upgrades prose quality at higher cost.
- Indexes are declared in `lib/models.ts`.

## License

[MIT](LICENSE) © 2026 Charan Raj Kandula. Built by Harakumo.

# Lectoire — Decisions

One entry per decision that can be seen in the code, the README or
[creator-payouts.md](creator-payouts.md). The repository's history begins with a
single commit, "Initial open-source release", on **2026-10-13**, so the original
date of each decision is not recorded here; every entry carries that date.
Where the code or docs record the alternatives that were weighed, they are
listed. Where they do not, the entry says so rather than guessing.

---

### 1. One Next.js application on a long-running Node server

- **Date:** 2026-10-13
- **Decided:** The public site, the signed-in app, the admin portal and every
  API live in one Next.js 16 App Router codebase, built as `output: "standalone"`
  and run with `node server.js` (Dockerfile on `node:22-slim`).
- **Options weighed:** The README contrasts a server app with a static site.
- **Why:** Studio replies stream for up to 300 seconds, exports render PDF and
  EPUB on the server, and housekeeping runs on an in-process timer. None of that
  fits a static site or short-lived functions.

### 2. MongoDB through Mongoose as the only datastore

- **Date:** 2026-10-13
- **Decided:** All text and state, including the money ledger, lives in one
  MongoDB database; schemas are in `lib/models.ts`. One connection is cached per
  process and `bufferCommands` is off so a dead socket fails fast.
- **Options weighed:** Not recorded. The README says "MongoDB is required for
  now".
- **Why:** Not stated beyond that. The data is document-shaped (subscription,
  sale terms and reading progress are embedded objects).

### 3. Username-or-email and password, with a JWT cookie

- **Date:** 2026-10-13
- **Decided:** bcrypt-hashed passwords; a 30-day HS256 JWT in an `httpOnly`
  cookie; pages re-check that the user still exists on every request.
- **Options weighed:** Not recorded.
- **Why:** The re-check is explained in `lib/auth.ts`: a valid token for a
  deleted user made `/login` and `/home` redirect at each other forever.

### 4. Tell the truth about password reset

- **Date:** 2026-10-13
- **Decided:** `/forgot-password` says automatic reset is not switched on and
  points to the contact address or form.
- **Options weighed:** A "check your inbox" form.
- **Why:** With no mail provider sending to users, such a form would strand
  everyone who used it.

### 5. The Studio holds the pen: a server-side agent loop streamed as SSE

- **Date:** 2026-10-13
- **Decided:** `POST /api/studio/chat` runs up to 12 rounds of Anthropic calls
  with 8 tools that write chapters and covers straight into MongoDB, streaming
  `text/event-stream` events to the browser. Only text is kept in history; the
  system prompt carries the live book state instead of replaying tool calls.
- **Options weighed:** Not recorded for the transport.
- **Why:** The stream is one-way and ends with the turn. The loop keeps writing
  if the browser goes away, so the book is not lost.

### 6. A cheap default writing model, the strongest model for drawings

- **Date:** 2026-10-13
- **Decided:** `BOOK_MODEL` defaults to `claude-haiku-4-5-20251001` and can be
  raised by env; `ILLUSTRATION_MODEL` defaults to `claude-opus-5` and is not tied
  to `BOOK_MODEL`.
- **Options weighed:** One model for both.
- **Why:** `lib/anthropic.ts`: prose from a fast model reads fine, but a drawing
  expressed as SVG coordinates by a fast model "comes out as coloured blobs".

### 7. One set of edit executors for the Studio, the editor and MCP

- **Date:** 2026-10-13
- **Decided:** The hand editor's chapter routes and the MCP tools call
  `executeStudioTool()` from `lib/studio.ts`.
- **Why:** MCP edits and in-app edits behave identically.

### 8. A stateless MCP server with two ways to sign in

- **Date:** 2026-10-13
- **Decided:** `/api/mcp` speaks Streamable HTTP in stateless mode: each POST
  carries JSON-RPC and gets one JSON reply, with no session and no SSE. It
  accepts a personal `emb_` token or an OAuth access token.
- **Options weighed:** The stateful mode of the spec (sessions, SSE streams).
- **Why:** Twelve request-response tools need neither. Inference runs on the
  user's own Claude subscription, not the app's key (README).

### 9. Open OAuth client registration, PKCE always

- **Date:** 2026-10-13
- **Decided:** claude.ai registers itself through RFC 7591; every grant needs
  the user signed in on the consent screen and a PKCE S256 challenge.
- **Why:** The connector must work without manual client setup, while no app
  can act for a user who has not approved it.

### 10. Media in any S3-compatible bucket, uploaded directly from the browser

- **Date:** 2026-10-13
- **Decided:** `lib/storage.ts` uses generic `STORAGE_*` settings and presigned
  PUT URLs with the content length signed. A cover URL is accepted only if it
  points into that bucket.
- **Options weighed:** Uploading through the server.
- **Why:** Large files never pass through the web server, a client cannot sign
  for 1 MB and upload 10 GB, and a stored cover can never be a foreign URL.

### 11. Generated covers by default, real artwork optional

- **Date:** 2026-10-13
- **Decided:** Every book gets a deterministic typeset cover (12 palettes × 4
  layouts) with no image assets. With an xAI key, the Studio can paint or edit
  cover art, requested as base64 and stored as WebP.
- **Options weighed:** Taking xAI's returned image URL.
- **Why:** Those URLs are temporary; keeping the bytes means the only copy that
  matters is the stored one.

### 12. Chapter illustrations run as queued jobs, with a safe SVG fallback

- **Date:** 2026-10-13
- **Decided:** `generate_chapter_image` writes an `IllustrationJob` and returns at
  once. Without xAI, the illustration model writes SVG, which is sanitised,
  shown through `<img>`, and given a PNG twin for PDF and DOCX.
- **Options weighed:** Drawing inside the chat turn.
- **Why:** A drawing takes minutes and would make the Studio look frozen; SVG is
  untrusted input that could otherwise run scripts in readers' browsers.

### 13. Narration by an external service, keyed by the chapter text

- **Date:** 2026-10-13
- **Decided:** Lectoire sends chapter text to a service speaking the Chanova
  Audio API and stores only the returned audio URLs, keyed by a hash of the
  text. Any reader who can open a chapter may start its narration; publishing
  starts the whole book; editing does not.
- **Options weighed:** Synthesising on the web server; author-only narration
  (the earlier rule, per the audio route's comment).
- **Why:** Speech work is CPU-heavy, so it stays off the web server. The service
  now plays a short opening part within seconds, and author-only narration left
  most chapters silent. Re-narrating on every edit would waste work on text
  about to change again.

### 14. Priced books are bought; unpriced books are in Plus

- **Date:** 2026-10-13
- **Decided:** `lib/entitlement.ts` is the single reading gate: owner, free,
  bought, then Plus. A book with a price is not in Plus. A purchase is checked
  before Plus, so a bought book survives a lapsed subscription.
- **Options weighed:** `creator-payouts.md` lists A (revenue pool), B (split
  catalog) and C (author's choice per book), recommending "B now, C later".
- **Why:** Plus giving every book away would pay authors nothing; a pool needs
  monthly accounting that does not exist yet.

### 15. Authors get 70% of the net, with a $2.99 minimum

- **Date:** 2026-10-13
- **Decided:** Deduct the card fee first, then split 70/30 (`splitSale`).
  Minimum price $2.99, maximum $99.99.
- **Options weighed:** Splitting the gross.
- **Why:** With a flat 30¢ fee, a gross split loses money on every sale below
  about $1.11; a net split never goes negative.

### 16. Earnings are derived from the ledger, not stored

- **Date:** 2026-10-13
- **Decided:** `purchases` is an immutable ledger; refunds and disputes change a
  row's status. `earningsFor()` sums the ledger and subtracts payout records.
- **Options weighed:** A stored balance credited per sale (the design doc's
  `balanceCents`).
- **Why:** A stored balance can drift from its transactions; a derived one
  cannot, and a refund needs no compensating write.

### 17. Hold money 30 days and freeze on suspicion

- **Date:** 2026-10-13
- **Decided:** Sales clear after 30 days. The first dispute freezes the author's
  payouts. An abuse screen freezes (never blocks) on patterns like brand-new
  buyer accounts or bulk buying.
- **Why:** Card disputes arrive 30 to 90 days after a sale, so instant payouts
  would pay fraudsters. A real launch day looks like wash trading, so the money
  waits for a human instead of sales being refused.

### 18. Stripe Connect Express for author payouts

- **Date:** 2026-10-13
- **Decided:** Authors onboard on Stripe's hosted flow; Lectoire keeps only the
  account id and opens Stripe's dashboard for bank details and tax forms.
- **Options weighed:** Collecting bank details in Lectoire.
- **Why:** That would be a security liability and a tax obligation; with
  Express, Stripe collects identity and tax data.

### 19. Record the payout before moving the money

- **Date:** 2026-10-13
- **Decided:** A `pending` `PayoutRecord` is written first and its id becomes the
  Stripe idempotency key; housekeeping finishes interrupted ones.
- **Why:** A crash between the two steps can neither lose an author's money nor
  pay it twice.

### 20. Webhook idempotency enforced by the database

- **Date:** 2026-10-13
- **Decided:** `purchases.stripeSessionId` has a unique partial index.
- **Options weighed:** A "have we seen this?" read before writing.
- **Why:** Stripe delivers webhooks at least once; two deliveries can both pass
  the read and both credit the author.

### 21. Verify Stripe sessions on the return page too

- **Date:** 2026-10-13
- **Decided:** `/plus` and `/orders` read the Checkout session on return and
  update the database, as well as the webhook doing so.
- **Why:** Local development works even when Stripe cannot reach the machine.

### 22. Simple print pricing and manual fulfilment

- **Date:** 2026-10-13
- **Decided:** Flat launch pricing ($5.00 + $0.04 a page, $4.99 delivery, 8%
  tax), fulfilled by an admin from the portal. Authors may set a paperback price
  at least $3.00 above cost and earn 70% of the margin after the card fee.
- **Options weighed:** Stripe Tax, named in `lib/pricing.ts` as the swap to make
  "before selling widely".
- **Why:** Below about $3 of margin the card fee eats the platform's share.

### 23. Housekeeping on an in-process timer and an external hook

- **Date:** 2026-10-13
- **Decided:** `instrumentation.ts` starts a 15-minute sweep in production;
  `POST /api/cron/narration` with `CRON_SECRET` runs the same sweep. Every step
  is safe to repeat.
- **Why:** Narrations, drawings and payouts killed by a restart had nobody
  watching them; idempotent steps make several instances ticking at once
  harmless.

### 24. Installable PWA with a service worker that caches nothing

- **Date:** 2026-10-13
- **Decided:** `public/sw.js` passes every request to the network.
- **Options weighed:** An offline cache.
- **Why:** Books, progress and the Studio are live data; "a stale shell would be
  worse than none". Offline reading is left as a separate, deliberate step.

### 25. A founding-member launch offer that expires on its own

- **Date:** 2026-10-13
- **Decided:** The first 10 accounts get one month of Plus free, counted by the
  `foundingMember` flag. Free grants enforce their own end date; paid
  subscriptions trust Stripe.
- **Why:** Counting the flag means deleting a test account does not free an
  extra spot; a grant with no Stripe subscription gets no webhook to end it; a
  late webhook must never lock out a paying member.

### 26. Team alerts only, fail-soft, through Harakumo Mail

- **Date:** 2026-10-13
- **Decided:** Email goes to the team (contact messages, paid print orders,
  disputes) through one `HARAKUMO_API_KEY`, fire-and-forget. Users get no email.
- **Why:** An alert that cannot go out must never break the request that raised
  it.

### 27. An AI-written catalog with an honest byline

- **Date:** 2026-10-13
- **Decided:** `npm run generate:catalog` writes complete books under
  "Lectoire Originals" and replaces only ownerless catalog books.
- **Options weighed:** Invented human author names.
- **Why:** The script's header: "no fake human authors".

### 28. Publish the code as open source

- **Date:** 2026-10-13
- **Decided:** MIT licence. Every deployment-specific value comes from the
  environment: `NEXT_PUBLIC_ORIGIN` for links, `CONTACT_EMAIL` and
  `ADMIN_EMAIL` empty by default, `.env.example` with placeholders only. Each
  optional service switches itself off when its key is missing.
- **Why:** The README states the licence and that the app is published on
  Nucleus; it gives no further reason. The code is shaped so a stranger can run
  it with only MongoDB, an auth secret and an Anthropic key.

### 29. Stay neutral about where it runs

- **Date:** 2026-10-13
- **Decided:** Storage is "any S3-compatible bucket" with a configurable
  endpoint; the Dockerfile targets "any container host"; there is no
  host-specific code.
- **Why:** The same build runs on any Node host, or as a server app on
  Harakumo as the README describes.

### 30. Admins are made by hand, then by other admins

- **Date:** 2026-10-13
- **Decided:** The first admin is set with `role: "admin"` in the `users`
  collection; admins promote or demote others from `/admin/users` but cannot
  change their own role.
- **Options weighed:** Not recorded.
- **Why:** Not stated in the code or README.

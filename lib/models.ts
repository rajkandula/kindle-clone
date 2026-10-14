import mongoose, { Schema, model, models, type Model } from "mongoose";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface IAddress {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

import type { SubscriptionStatus } from "./plan";
export { PLAN, type SubscriptionStatus } from "./plan";

/** Lectoire Plus billing state, mirrored from Stripe. */
export interface ISubscription {
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  /** Paid-through date; access continues to here after cancellation. */
  currentPeriodEnd: Date | null;
  /** True when the user cancelled but the period hasn't ended yet. */
  cancelAtPeriodEnd: boolean;
}

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
  /** Optional: accounts created before email was collected have none. */
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  /** Personal access token for the Lectoire MCP server ("" = none issued). */
  mcpToken: string;
  /** Last used delivery address, prefilled at checkout. */
  savedAddress: IAddress | null;
  /** One of the first members, given Plus free at launch. */
  foundingMember: boolean;
  subscription: ISubscription;
  createdAt: Date;
  updatedAt: Date;
}

/** Whether this user currently has Lectoire Plus access. Admins always do. */
/** How many early members get Plus free, and for how long. */
export const FOUNDING_SPOTS = 10;
export const FOUNDING_MONTHS = 1;

export function hasPlus(user: Pick<IUser, "role" | "subscription">): boolean {
  if (user.role === "admin") return true;
  const sub = user.subscription;
  if (sub?.status !== "active") return false;

  // A free grant has no Stripe subscription behind it, so no webhook will ever
  // arrive to end it — it has to enforce its own expiry. Paid subscriptions are
  // left alone: Stripe is the authority there, and a late webhook must never
  // lock a paying member out of their books.
  if (!sub.stripeSubscriptionId && sub.currentPeriodEnd) {
    return sub.currentPeriodEnd.getTime() > Date.now();
  }
  return true;
}

export { GENRES, type Genre } from "./genres";

export interface ICoverStyle {
  /** Index into the cover palette table (lib/covers.ts). */
  palette: number;
  /** Index into the cover layout variants. */
  layout: number;
}

export interface IBook {
  _id: mongoose.Types.ObjectId;
  /** null → part of the built-in store catalog. */
  ownerId: mongoose.Types.ObjectId | null;
  title: string;
  subtitle: string;
  authorName: string;
  description: string;
  genre: string;
  tags: string[];
  status: "draft" | "published";
  /** Uploaded/custom cover image (object storage). Empty → generated SVG cover. */
  coverUrl: string;
  coverStyle: ICoverStyle;
  flags: { bestseller: boolean; free: boolean; featured: boolean };
  /**
   * Selling terms. A book with a price is bought individually and is NOT
   * included in Lectoire Plus — setting a price is how an author says
   * "this one is mine to sell". Leaving it unpriced keeps the book in Plus.
   */
  sale: {
    enabled: boolean;
    priceCents: number;
    /** Paperback list price. 0 → print stays at cost and earns the author nothing. */
    printPriceCents: number;
    currency: string;
  };
  chapterCount: number;
  wordCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChapter {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  index: number; // 1-based position
  title: string;
  content: string; // markdown
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProgress {
  chapterIndex: number;
  /** 0..1 scroll position within the chapter. */
  offset: number;
  /** 0..1 overall book progress (share of chapters actually read). */
  percent: number;
  /** Chapter indexes the reader has actually finished — jumping ahead
   *  doesn't mark skipped chapters as read. */
  chaptersRead: number[];
}

export interface ILibraryEntry {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  inLibrary: boolean;
  wantToRead: boolean;
  finished: boolean;
  progress: IProgress | null;
  lastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const HIGHLIGHT_COLORS = ["amber", "green", "rose", "blue"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export interface IHighlight {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  chapterIndex: number;
  /** Exact selected text (as rendered, plain). */
  text: string;
  /** Character offset of the selection start within the chapter's plain text. */
  start: number;
  color: HighlightColor;
  createdAt: Date;
  updatedAt: Date;
}

export { ORDER_STATUSES, type OrderStatus } from "./order-statuses";
import { ORDER_STATUSES, type OrderStatus } from "./order-statuses";

/** A print-on-demand order for a physical copy of a book. */
export interface IOrder {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  /** Snapshots so the order survives book edits/deletion. */
  bookTitle: string;
  bookAuthor: string;
  quantity: number;
  pages: number;
  address: IAddress;
  /** All amounts in cents (USD). */
  amounts: {
    printing: number;
    delivery: number;
    tax: number;
    total: number;
  };
  status: OrderStatus;
  stripeSessionId: string;
  /** Admin note shown to the customer (e.g. carrier + tracking number). */
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

/* ---------- OAuth (claude.ai connector sign-in service) ---------- */

/** An OAuth client registered via dynamic client registration (RFC 7591). */
export interface IOAuthClient {
  _id: mongoose.Types.ObjectId;
  clientId: string;
  name: string;
  redirectUris: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** A short-lived authorization code awaiting exchange at the token endpoint. */
export interface IOAuthCode {
  _id: mongoose.Types.ObjectId;
  code: string;
  clientId: string;
  userId: mongoose.Types.ObjectId;
  redirectUri: string;
  /** PKCE S256 challenge — required for every grant. */
  codeChallenge: string;
  scope: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** An issued access grant — gives the same library access as an mcpToken. */
export interface IOAuthToken {
  _id: mongoose.Types.ObjectId;
  token: string;
  refreshToken: string;
  userId: mongoose.Types.ObjectId;
  clientId: string;
  /** Snapshot for the "Connected apps" list. */
  clientName: string;
  scope: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Narration for one chapter, produced by the Chanova Audio service.
 *
 * Keyed by a hash of the chapter text, so editing a chapter simply produces
 * a new record and the stale audio is never served.
 */
export interface INarration {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  chapterIndex: number;
  /** sha256 of the spoken text — changes whenever the chapter is edited. */
  textHash: string;
  voice: string;
  /** Job id at the audio service, while it renders. */
  jobId: string;
  status: "preparing" | "ready" | "error";
  urls: string[];
  parts: number;
  totalParts: number;
  durationSeconds: number;
  error: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CONTACT_STATUSES = ["new", "read", "replied"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** A message sent through the public contact page. */
export interface IContactMessage {
  _id: mongoose.Types.ObjectId;
  /** Set when the sender was signed in. */
  userId: mongoose.Types.ObjectId | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** The draft book this studio project is building. */
  bookId: mongoose.Types.ObjectId;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** A tool action the assistant took during a turn, for the activity feed. */
export interface IToolEvent {
  tool: string;
  label: string;
}

export interface IMessage {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  events: IToolEvent[];
  createdAt: Date;
  updatedAt: Date;
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_.]{3,20}$/,
    },
    // Sparse: accounts predate email collection, and a plain unique index
    // would reject every one of them for colliding on null.
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 200,
      index: { unique: true, sparse: true, partialFilterExpression: { email: { $type: "string", $ne: "" } } },
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    mcpToken: { type: String, default: "" },
    savedAddress: {
      type: {
        name: { type: String, default: "" },
        phone: { type: String, default: "" },
        line1: { type: String, default: "" },
        line2: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        postalCode: { type: String, default: "" },
        country: { type: String, default: "" },
      },
      default: null,
    },
    /** One of the first members, given Plus free at launch. */
    foundingMember: { type: Boolean, default: false },
    subscription: {
      status: {
        type: String,
        enum: ["none", "active", "past_due", "canceled"],
        default: "none",
      },
      stripeCustomerId: { type: String, default: "" },
      stripeSubscriptionId: { type: String, default: "" },
      currentPeriodEnd: { type: Date, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);
UserSchema.index(
  { mcpToken: 1 },
  { unique: true, partialFilterExpression: { mcpToken: { $gt: "" } } }
);

const BookSchema = new Schema<IBook>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, default: "", trim: true, maxlength: 300 },
    authorName: { type: String, default: "", trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 5000 },
    genre: { type: String, default: "Fiction", maxlength: 40 },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    coverUrl: { type: String, default: "" },
    coverStyle: {
      palette: { type: Number, default: 0 },
      layout: { type: Number, default: 0 },
    },
    flags: {
      bestseller: { type: Boolean, default: false },
      free: { type: Boolean, default: false },
      featured: { type: Boolean, default: false },
    },
    sale: {
      enabled: { type: Boolean, default: false },
      priceCents: { type: Number, default: 0, min: 0 },
      printPriceCents: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: "usd" },
    },
    chapterCount: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
BookSchema.index({ status: 1, publishedAt: -1 });
BookSchema.index({ status: 1, genre: 1 });

const ChapterSchema = new Schema<IChapter>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    index: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
ChapterSchema.index({ bookId: 1, index: 1 }, { unique: true });

const LibraryEntrySchema = new Schema<ILibraryEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    inLibrary: { type: Boolean, default: false },
    wantToRead: { type: Boolean, default: false },
    finished: { type: Boolean, default: false },
    progress: {
      type: {
        chapterIndex: { type: Number, default: 1 },
        offset: { type: Number, default: 0 },
        percent: { type: Number, default: 0 },
        chaptersRead: { type: [Number], default: [] },
      },
      default: null,
    },
    lastReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);
LibraryEntrySchema.index({ userId: 1, bookId: 1 }, { unique: true });
LibraryEntrySchema.index({ userId: 1, lastReadAt: -1 });

const HighlightSchema = new Schema<IHighlight>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    chapterIndex: { type: Number, required: true },
    text: { type: String, required: true, maxlength: 1200 },
    start: { type: Number, required: true, min: 0 },
    color: { type: String, enum: [...HIGHLIGHT_COLORS], default: "amber" },
  },
  { timestamps: true }
);
HighlightSchema.index({ userId: 1, bookId: 1, chapterIndex: 1 });

const AddressSchema = new Schema<IAddress>(
  {
    name: { type: String, required: true, maxlength: 120 },
    phone: { type: String, default: "", maxlength: 40 },
    line1: { type: String, required: true, maxlength: 200 },
    line2: { type: String, default: "", maxlength: 200 },
    city: { type: String, required: true, maxlength: 100 },
    state: { type: String, default: "", maxlength: 100 },
    postalCode: { type: String, required: true, maxlength: 20 },
    country: { type: String, required: true, maxlength: 60 },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    bookTitle: { type: String, required: true },
    bookAuthor: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1, max: 10 },
    pages: { type: Number, required: true },
    address: { type: AddressSchema, required: true },
    amounts: {
      printing: { type: Number, required: true },
      delivery: { type: Number, required: true },
      tax: { type: Number, required: true },
      total: { type: Number, required: true },
    },
    status: { type: String, enum: [...ORDER_STATUSES], default: "pending_payment" },
    stripeSessionId: { type: String, default: "" },
    note: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ stripeSessionId: 1 });

const OAuthClientSchema = new Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true },
    name: { type: String, default: "Claude", trim: true, maxlength: 120 },
    redirectUris: { type: [String], required: true },
  },
  { timestamps: true }
);

const OAuthCodeSchema = new Schema<IOAuthCode>(
  {
    code: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    scope: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
// Mongo removes expired codes on its own
OAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OAuthTokenSchema = new Schema<IOAuthToken>(
  {
    token: { type: String, required: true, unique: true },
    refreshToken: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: String, required: true },
    clientName: { type: String, default: "Claude", maxlength: 120 },
    scope: { type: String, default: "" },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const NarrationSchema = new Schema<INarration>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    chapterIndex: { type: Number, required: true },
    textHash: { type: String, required: true },
    voice: { type: String, required: true },
    jobId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["preparing", "ready", "error"],
      default: "preparing",
    },
    urls: { type: [String], default: [] },
    parts: { type: Number, default: 0 },
    totalParts: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);
NarrationSchema.index(
  { bookId: 1, chapterIndex: 1, textHash: 1, voice: 1 },
  { unique: true }
);

const ContactMessageSchema = new Schema<IContactMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: CONTACT_STATUSES, default: "new" },
  },
  { timestamps: true }
);
ContactMessageSchema.index({ status: 1, createdAt: -1 });

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    title: { type: String, default: "New book project", maxlength: 160 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
ConversationSchema.index({ userId: 1, lastMessageAt: -1 });

const ToolEventSchema = new Schema<IToolEvent>(
  {
    tool: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    events: { type: [ToolEventSchema], default: [] },
  },
  { timestamps: true }
);
MessageSchema.index({ conversationId: 1, createdAt: 1 });

/* ------------------------------------------------------------------ */
/* Models (cached across hot reloads)                                  */
/* ------------------------------------------------------------------ */

export const User: Model<IUser> = models.User ?? model<IUser>("User", UserSchema);
export const Book: Model<IBook> = models.Book ?? model<IBook>("Book", BookSchema);
export const Chapter: Model<IChapter> =
  models.Chapter ?? model<IChapter>("Chapter", ChapterSchema);
export const LibraryEntry: Model<ILibraryEntry> =
  models.LibraryEntry ?? model<ILibraryEntry>("LibraryEntry", LibraryEntrySchema);
export const Order: Model<IOrder> =
  models.Order ?? model<IOrder>("Order", OrderSchema);
export const Highlight: Model<IHighlight> =
  models.Highlight ?? model<IHighlight>("Highlight", HighlightSchema);
export const ContactMessage: Model<IContactMessage> =
  models.ContactMessage ?? model<IContactMessage>("ContactMessage", ContactMessageSchema);
export const Narration: Model<INarration> =
  models.Narration ?? model<INarration>("Narration", NarrationSchema);
export const OAuthClient: Model<IOAuthClient> =
  models.OAuthClient ?? model<IOAuthClient>("OAuthClient", OAuthClientSchema);
export const OAuthCode: Model<IOAuthCode> =
  models.OAuthCode ?? model<IOAuthCode>("OAuthCode", OAuthCodeSchema);
export const OAuthToken: Model<IOAuthToken> =
  models.OAuthToken ?? model<IOAuthToken>("OAuthToken", OAuthTokenSchema);
export const Conversation: Model<IConversation> =
  models.Conversation ?? model<IConversation>("Conversation", ConversationSchema);
export const Message: Model<IMessage> =
  models.Message ?? model<IMessage>("Message", MessageSchema);

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Plain-JSON book shape passed to client components. */
export interface BookLite {
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  description: string;
  genre: string;
  status: "draft" | "published";
  coverUrl: string;
  coverStyle: ICoverStyle;
  flags: { bestseller: boolean; free: boolean; featured: boolean };
  /** 0 when the book isn't sold separately (free, or included in Plus). */
  priceCents: number;
  chapterCount: number;
  wordCount: number;
  isOwn?: boolean;
}

export function toBookLite(b: IBook, viewerId?: string): BookLite {
  return {
    id: b._id.toString(),
    title: b.title,
    subtitle: b.subtitle,
    authorName: b.authorName,
    description: b.description,
    genre: b.genre,
    status: b.status,
    coverUrl: b.coverUrl,
    coverStyle: { palette: b.coverStyle?.palette ?? 0, layout: b.coverStyle?.layout ?? 0 },
    flags: {
      bestseller: b.flags?.bestseller ?? false,
      free: b.flags?.free ?? false,
      featured: b.flags?.featured ?? false,
    },
    priceCents: b.sale?.enabled ? (b.sale.priceCents ?? 0) : 0,
    chapterCount: b.chapterCount,
    wordCount: b.wordCount,
    isOwn: viewerId ? b.ownerId?.toString() === viewerId : false,
  };
}

/* ------------------------------------------------------------------ */
/* Creator earnings                                                    */
/* ------------------------------------------------------------------ */

/**
 * The author's share of a sale, taken after payment processing.
 *
 * Splitting the net rather than the gross matters: Stripe's flat 30c means a
 * gross split goes negative on cheap books, so the platform would lose money on
 * exactly the titles that sell in volume. Netting the fee first can never do
 * that, and it is the split authors already know from Gumroad and Substack.
 */
export const AUTHOR_SHARE = 0.7;
/** Below this a card fee eats most of the sale, so neither side earns. */
export const MIN_PRICE_CENTS = 299;
export const MAX_PRICE_CENTS = 99_99;
/** Not worth a bank transfer below this. */
export const MIN_PAYOUT_CENTS = 2500;

/**
 * How long a sale must settle before it can be paid out.
 *
 * This is the single most important fraud control here. The attack it defeats:
 * buy your own book through a second account using stolen cards, collect the
 * payout, disappear. Card disputes arrive weeks later — typically 30-90 days —
 * so paying instantly means paying the fraudster and eating every chargeback.
 * Holding funds means the disputes land while we still have the money.
 */
export const HOLD_DAYS = 30;

export function holdCutoff(now = new Date()): Date {
  return new Date(now.getTime() - HOLD_DAYS * 24 * 60 * 60 * 1000);
}

/** Stripe's standard card pricing, used to show authors what they'll earn. */
export function stripeFeeCents(grossCents: number): number {
  return Math.round(grossCents * 0.029) + 30;
}

/** How one sale divides. All values in cents. */
export function splitSale(grossCents: number) {
  const fee = stripeFeeCents(grossCents);
  const net = Math.max(0, grossCents - fee);
  const author = Math.round(net * AUTHOR_SHARE);
  return { gross: grossCents, fee, net, author, platform: net - author };
}

export interface IPurchase {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId | null;
  grossCents: number;
  feeCents: number;
  netCents: number;
  authorCents: number;
  platformCents: number;
  currency: string;
  stripeSessionId: string;
  status: "paid" | "refunded" | "disputed";
  createdAt: Date;
  refundedAt: Date | null;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    grossCents: { type: Number, required: true },
    feeCents: { type: Number, required: true },
    netCents: { type: Number, required: true },
    authorCents: { type: Number, required: true },
    platformCents: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    stripeSessionId: { type: String, default: "" },
    status: { type: String, enum: ["paid", "refunded", "disputed"], default: "paid" },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
/**
 * One purchase per Stripe session, enforced by the database.
 *
 * Stripe delivers webhooks at least once, so a "have we seen this?" read is a
 * race: two deliveries can both pass it and both credit the author. Partial so
 * that rows without a session id (none today, but manual grants later) don't
 * collide on the empty string.
 */
PurchaseSchema.index(
  { stripeSessionId: 1 },
  { unique: true, partialFilterExpression: { stripeSessionId: { $gt: "" } } }
);
PurchaseSchema.index({ buyerId: 1, bookId: 1 });
PurchaseSchema.index({ authorId: 1, createdAt: -1 });

export const Purchase: Model<IPurchase> =
  models.Purchase ?? model<IPurchase>("Purchase", PurchaseSchema);

export interface IAuthorAccount {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Stripe Connect Express account. Stripe holds the bank and tax details. */
  stripeAccountId: string;
  onboarded: boolean;
  balanceCents: number;
  lifetimeCents: number;
  paidOutCents: number;
  /** Payouts held pending review — set automatically on a dispute. */
  frozen: boolean;
  frozenReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuthorAccountSchema = new Schema<IAuthorAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    stripeAccountId: { type: String, default: "", index: true },
    onboarded: { type: Boolean, default: false },
    balanceCents: { type: Number, default: 0 },
    lifetimeCents: { type: Number, default: 0 },
    paidOutCents: { type: Number, default: 0 },
    frozen: { type: Boolean, default: false },
    frozenReason: { type: String, default: "" },
  },
  { timestamps: true }
);

export const AuthorAccount: Model<IAuthorAccount> =
  models.AuthorAccount ?? model<IAuthorAccount>("AuthorAccount", AuthorAccountSchema);

export interface IPayoutRecord {
  _id: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  amountCents: number;
  stripeTransferId: string;
  status: "pending" | "paid" | "failed";
  error: string;
  createdAt: Date;
}

const PayoutRecordSchema = new Schema<IPayoutRecord>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountCents: { type: Number, required: true },
    stripeTransferId: { type: String, default: "" },
    // "pending" exists so a payout interrupted mid-flight can be finished
    // safely rather than silently swallowing an author's balance.
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PayoutRecord: Model<IPayoutRecord> =
  models.PayoutRecord ?? model<IPayoutRecord>("PayoutRecord", PayoutRecordSchema);

/** A priced book must be bought; an unpriced one follows the Plus rules. */
export function isForSale(book: Pick<IBook, "sale">): boolean {
  return Boolean(book.sale?.enabled) && (book.sale?.priceCents ?? 0) >= MIN_PRICE_CENTS;
}

/** A drawing the Studio has been asked for but hasn't finished. */
export interface IIllustrationJob {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  chapterIndex: number;
  subject: string;
  alt: string;
  placement: "top" | "bottom";
  status: "pending" | "done" | "error";
  error: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const IllustrationJobSchema = new Schema<IIllustrationJob>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    chapterIndex: { type: Number, required: true },
    subject: { type: String, required: true },
    alt: { type: String, default: "Illustration" },
    placement: { type: String, enum: ["top", "bottom"], default: "bottom" },
    status: { type: String, enum: ["pending", "done", "error"], default: "pending", index: true },
    error: { type: String, default: "" },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const IllustrationJob: Model<IIllustrationJob> =
  models.IllustrationJob ?? model<IIllustrationJob>("IllustrationJob", IllustrationJobSchema);

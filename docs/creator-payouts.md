# Paying creators — design

How an author sets a price, how a reader buys, and how the money reaches the
author's bank account. Written before any code so the awkward cases are decided
deliberately rather than discovered in production.

**Chosen so far:** direct sale (author sets the price), author share **70%**.

---

## 1. Two problems to settle first

### 1.1 Plus currently gives every book away, and authors get nothing

`app/(app)/store/[id]/page.tsx` gates reading on:

```ts
isOwn || book.flags.free || user.plus
```

So a Plus subscriber reads **every** book in the store, including books written
by other people. If we add prices without changing this, an author's book is
still handed free to every subscriber, and — with no revenue pool — the author
earns nothing from them. That is worse than having no marketplace at all: we
would be monetising other people's work and paying them zero.

Three honest ways out:

| | What Plus covers | Author earns from Plus readers | Complexity |
|---|---|---|---|
| **A. Pool** | Everything, as today | Yes — share of subscription revenue by chapters read | High: pool accounting, monthly close |
| **B. Split catalog** | Lectoire Originals + free books only | N/A — their books are never given away | Low |
| **C. Author's choice per book** | Originals, free books, and any book its author opts in | Only if they opt in (needs the pool) | High |

**Recommendation: B now, C later.** It is the only option that is both honest
and buildable without pool accounting. Plus stops meaning "every book ever
published here" and starts meaning "the whole Lectoire Originals library, all
narrated, plus the Studio and downloads" — which is what people are actually
paying for today (at the time of writing, the catalog was essentially
Originals). Marketplace books are bought individually.

The Plus marketing copy must change with it. `lib/plan.ts` currently promises
"Read every book in the store, cover to cover" — that becomes false the moment
another author sets a price, so it has to be reworded in the same change.

### 1.2 Splitting the gross loses money on cheap books

Stripe charges roughly **2.9% + $0.30** per transaction. If the split is taken
off the gross price, Lectoire's share is:

```
0.30 × P − (0.029 × P + 0.30)  =  0.271 × P − 0.30
```

which is **negative below $1.11**. A $0.99 book would cost us money every time
someone bought it. The flat $0.30 is what does the damage: on a cheap book it
dwarfs the percentage, so the cheaper the book, the worse the economics — and
cheap books are exactly the ones that sell in volume.

**Fix: split the net, not the gross.** Deduct payment processing first, then
70/30 the remainder. This is what Gumroad and Substack do, it is easy to explain
to authors, and it can never go negative:

| Price | Stripe fee | Net | Author 70% | Lectoire 30% |
|---|---|---|---|---|
| $2.99 | $0.39 | $2.60 | **$1.82** | $0.78 |
| $4.99 | $0.44 | $4.55 | **$3.19** | $1.36 |
| $9.99 | $0.59 | $9.40 | **$6.58** | $2.82 |
| $19.99 | $0.88 | $19.11 | **$13.38** | $5.73 |

70/30 is the number authors already recognise — Apple, Google Play and Amazon
KDP's main tier all use it — so it needs no defending. Taking it on the net
rather than the gross is the part worth stating plainly in the author terms.

Also set a **minimum price of $2.99** (or free). Below that the fee is such a
large fraction that neither side earns anything worth accounting for.

Authors must see this before they publish — the price editor should show
"You earn $3.19 per sale" live, not just the list price.

---

## 2. Data model

```ts
// Book — new fields
sale: {
  priceCents: number;          // 0 = free; otherwise >= 299
  currency: "usd";
  enabled: boolean;            // author has switched on selling
}

// Purchase — one row per completed sale, immutable
{
  bookId, buyerId, authorId,
  grossCents, feeCents, netCents, authorCents, platformCents,
  currency, stripeSessionId, stripePaymentIntentId,
  status: "paid" | "refunded",
  createdAt, refundedAt
}

// AuthorAccount — one per author who sells
{
  userId,
  stripeAccountId: string,     // Stripe Connect Express account
  onboarded: boolean,          // charges_enabled && payouts_enabled
  balanceCents: number,        // owed but not yet paid out
  lifetimeCents: number,
  updatedAt
}

// PayoutRecord — one per transfer out
{ authorId, amountCents, stripeTransferId, status, createdAt }
```

`Purchase` is the ledger and must never be edited in place — a refund writes a
status change plus a reversing effect on balance, so the history stays auditable.

## 3. Money flow

1. Author sets a price in the editor. If they have no Stripe account yet they
   can still set it, but the book cannot be published for sale until onboarded
   (otherwise we take money we cannot pay out).
2. Reader clicks **Buy** → Stripe Checkout (one-time payment, Lectoire's
   account).
3. Webhook `checkout.session.completed` → write `Purchase`, credit
   `AuthorAccount.balanceCents` by `authorCents`. Idempotent on session id, the
   same way the existing Plus and print webhooks work.
4. Buyer's entitlement is the `Purchase` row. The reading gate becomes:
   `isOwn || free || purchased || (plus && isOriginal)`.
5. Payout: Stripe Transfer from platform balance to the author's connected
   account, on a schedule.

**Why Stripe Connect Express specifically:** the author onboards through
Stripe's own hosted flow, so Stripe collects bank details, identity documents
and tax forms. Lectoire never sees or stores any of it, and Stripe issues the
1099s. Building our own bank-details form would create a security liability and
a tax-compliance obligation we are not equipped to carry.

## 4. The awkward cases

| Case | Decision |
|---|---|
| **Refund / chargeback** | Debit the author's balance by `authorCents`. If the balance is already paid out it goes negative and nets off future sales. Buyer loses access on refund, keeps it on chargeback (we eat it — fighting a reader over one book is not worth it). |
| **Author never onboards** | Sales still allowed only if onboarded. Balance from before onboarding (e.g. price set then Stripe disconnected) is held indefinitely, shown as "pending setup". Never expires. |
| **Author unpublishes or deletes the book** | Everyone who already bought it keeps permanent access. The reader entitlement is the `Purchase` row, not the book's published state. This must be stated in the Terms. |
| **Price change** | Applies to future sales only. Existing buyers are unaffected — they bought the book, not a subscription to it. |
| **Author buys their own book** | Blocked. Free self-purchase is a fee-farming and money-laundering vector. |
| **Book is free then priced** | Allowed. Existing readers who "got" it while free keep it — record a zero-value `Purchase` at acquisition time so entitlement is provable. |
| **Minimum payout** | $25. Below that, Stripe's transfer overhead and the accounting noise are not worth it. Balance rolls forward. |
| **Payout schedule** | Monthly, on the 1st, for balances over the threshold. Predictable beats fast. |
| **Currency** | USD only at launch. Multi-currency means FX handling and per-country tax rules; not a launch problem. |
| **Sales tax / VAT** | Stripe Tax on the Checkout session. Digital goods are taxable in many places and getting this wrong is a real liability. Tax is collected on top and never counts toward the author split. |
| **Print orders of an author's book** | Not in this phase (print royalty was not selected). Today's print pricing is cost recovery, so no author money is involved and nothing is being withheld. Worth revisiting — an author whose book someone orders in print currently earns nothing from it. |
| **AI-written books** | Already covered: the Terms state the author owns what the Studio helps them write. No change needed. |
| **Fraud / stolen manuscripts** | Reactive: a report route and the ability to unpublish plus freeze a balance. Not automated at this stage, but the freeze capability must exist from day one. |

## 5. Build order

Each stage is useful on its own and safe to stop after.

1. **Split Plus from the marketplace** — reading gate, `isOriginal`, plan copy.
   Nothing else is honest until this lands.
2. **Price setting** — `sale` fields, editor UI with live "you earn" figure,
   $2.99 minimum, validation server-side as well as in the UI.
3. **Buy flow** — Checkout session, webhook, `Purchase`, entitlement in the
   reader and store. Authors can now earn, with balances accruing.
4. **Author earnings page** — sales list, balance, lifetime total. Read-only,
   so authors can see money accumulating before payouts exist.
5. **Stripe Connect onboarding** — Express account link, return/refresh URLs,
   `account.updated` webhook to flip `onboarded`.
6. **Payouts** — monthly transfer job, `PayoutRecord`, payout history in the UI.
7. **Refund handling** — admin refund action and `charge.refunded` webhook.

Stages 1–4 can ship without any payout machinery, and it is genuinely better to
have money visibly accruing before building the pipe that moves it.

## 6. Open questions for later

- Do Plus subscribers get a discount on marketplace books? (Reasonable, and a
  strong reason to subscribe — but complicates the split.)
- Should authors be able to opt into Plus for a share of a revenue pool
  (option C)? Worth doing once there are enough author books that being outside
  Plus is a real disadvantage.
- Print royalties — authors currently earn nothing when their book is printed.
- Bundles, series pricing, launch discounts. All later.

import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = { title: "Terms & Conditions" };

const SECTIONS: LegalSection[] = [
  {
    heading: "Agreeing to these terms",
    paragraphs: [
      "By creating an Lectoire account or using the service, you agree to these terms. If you don't agree with them, please don't use Lectoire.",
    ],
  },
  {
    heading: "Your account",
    bullets: [
      "You must be at least 13 years old to create an account.",
      "Keep your password to yourself — you're responsible for activity under your account.",
      "Give accurate details, particularly a delivery address if you order a printed book.",
      "Tell us promptly if you believe someone else has access to your account.",
    ],
  },
  {
    heading: "Who owns what you write",
    paragraphs: [
      "You own your books. Everything you write on Lectoire — including chapters drafted with the AI Studio at your direction — belongs to you, and you keep every right to publish, sell or move it elsewhere.",
      "We need a limited licence to operate the service: permission to store your work, display it back to you, render covers and audio for it, and — only if you choose to publish — show it in the store to other readers. Unpublishing withdraws that. We claim no ownership and take no royalty.",
    ],
  },
  {
    heading: "Books in the store",
    paragraphs: [
      "Books published by Lectoire and by other members remain the property of their authors. Your Lectoire account gives you permission to read them, and to download or print copies for your own personal use. It does not give you the right to redistribute, resell or republish someone else's book.",
    ],
  },
  {
    heading: "What you may not do",
    bullets: [
      "Publish material you don't have the rights to, or that infringes someone else's copyright.",
      "Publish content that is unlawful, hateful, harassing, or sexualises children.",
      "Attempt to break, overload, scrape or gain unauthorised access to the service.",
      "Resell Lectoire access, or share your account so others avoid paying for it.",
      "Use the AI Studio to generate material that breaks these rules or the law.",
    ],
    paragraphs: [
      "We may remove content or suspend an account that breaks these rules. Where it's reasonable to do so, we'll tell you why.",
    ],
  },
  {
    heading: "Selling your books",
    paragraphs: [
      "You decide whether a book is free, included with Lectoire Plus, or sold at a price you set. Setting a price takes the book out of Plus — it is then bought individually, and you earn from it.",
    ],
    bullets: [
      "You keep 70% of every sale after payment processing costs. On a $4.99 book that is $3.19 to you.",
      "Paperback prices are set by you above the cost of printing, and you keep 70% of the margin.",
      "Earnings clear 30 days after a sale. That is how long a card payment can be disputed, and paying sooner would mean paying out money that may be reclaimed.",
      "Withdraw any cleared balance over $25. There is no upper limit.",
      "Payouts are handled by Stripe. You provide your bank details, identity and tax information to Stripe directly — Lectoire never receives or stores them.",
      "You may change a price whenever you like. It applies to future sales only.",
      "We may pause payouts while we investigate disputed payments or activity that looks staged. We will tell you why, and release them as soon as it is resolved.",
    ],
  },
  {
    heading: "If you buy a book",
    paragraphs: [
      "Buying a book gives you permanent access to it in your library. That does not change if the author later raises the price, unpublishes it, or deletes it from Lectoire — your copy stays readable and downloadable.",
      "If a book is not what it claimed to be, tell us and we will refund it. A refunded book is removed from your library.",
    ],
  },
  {
    heading: "Lectoire Plus",
    bullets: [
      "Plus is billed in advance on a recurring basis until you cancel.",
      "You can cancel at any time; your benefits continue until the end of the period you've paid for.",
      "We don't pro-rate partial periods, but if something goes wrong on our side, write to us and we'll put it right.",
      "If prices change, existing subscribers will be told before the change takes effect.",
    ],
  },
  {
    heading: "Printed books",
    bullets: [
      "Printed orders are produced to order, so they can't be cancelled once printing has started.",
      "Delivery estimates are estimates, not guarantees.",
      "If a book arrives damaged, misprinted, or isn't what you ordered, contact us and we'll reprint or refund it.",
      "You're responsible for the accuracy of the delivery address you provide.",
    ],
  },
  {
    heading: "The AI Studio",
    paragraphs: [
      "The Studio is a writing tool, not an author or an authority. AI-generated text can be inaccurate, derivative or simply wrong, and you are responsible for reviewing what you publish under your name. Don't rely on it for legal, medical, financial or safety-critical advice.",
      "Fair use applies: the Studio is provided for genuine book writing, and we may limit usage that is automated, abusive, or far outside normal individual use.",
    ],
  },
  {
    heading: "Connected apps",
    paragraphs: [
      "You can connect Lectoire to Claude or another MCP client. A connected app acts with your permission and can create, edit and publish books in your library. You are responsible for what you connect and for what it does. Revoke access at any time from your connections page.",
    ],
  },
  {
    heading: "Availability",
    paragraphs: [
      "We work to keep Lectoire running, but we can't promise uninterrupted service. Features may change, and occasionally be withdrawn. If we plan to discontinue something you rely on, we'll give reasonable notice and — since your books download in six open formats — you'll always be able to take your work with you.",
    ],
  },
  {
    heading: "Liability",
    paragraphs: [
      "Lectoire is provided as-is. To the extent the law allows, we aren't liable for indirect or consequential losses, lost profits, or lost data. Nothing here limits liability that can't lawfully be limited. Keep your own copies of work that matters to you — downloading is free and unlimited.",
    ],
  },
  {
    heading: "Ending your account",
    paragraphs: [
      "You may stop using Lectoire and ask us to delete your account at any time. We may suspend or close an account that breaches these terms or the law. Before closing an account we'll give you a reasonable opportunity to download your books, unless doing so isn't possible.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      `We may update these terms as Lectoire grows. The date at the top of this page shows the last change, and significant changes will be announced in the app. Continuing to use Lectoire after a change means you accept the updated terms. Questions are welcome ${CONTACT_EMAIL ? `at ${CONTACT_EMAIL}` : "through the contact page"}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro="The agreement between you and Lectoire: what you can expect from us, what we ask of you, and — most importantly — the fact that the books you write here remain entirely yours."
      sections={SECTIONS}
    />
  );
}

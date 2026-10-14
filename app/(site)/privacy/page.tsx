import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = { title: "Privacy Policy" };

const SECTIONS: LegalSection[] = [
  {
    heading: "What we collect",
    paragraphs: [
      "We keep the minimum needed to run Lectoire, and we tell you plainly what that is.",
    ],
    bullets: [
      "Account: your display name, your username, and a cryptographic hash of your password. We never store your password itself and cannot read it.",
      "Your work: the books, chapters, covers and drafts you create, plus your library shelves, reading progress and highlights.",
      "Orders: if you order a printed book, the delivery address, phone number and order details you enter. You may save an address to reuse it.",
      "Payments: subscription and order status, and the reference Stripe gives us. Card numbers are entered on Stripe's own systems and never reach Lectoire.",
      "Messages: if you use the contact form, the name, email address, subject and message you send. A copy is emailed to us so we can reply.",
      "Connections: tokens for any app you connect, such as the Claude connector, so it can act on your behalf until you revoke it.",
      "Selling: if you sell books, a record of each sale and what you earned. Your bank details, identity documents and tax forms are collected and held by Stripe, not by us — we only ever see whether your account is ready to receive payouts.",
    ],
  },
  {
    heading: "What we don't do",
    bullets: [
      "We do not sell your personal information, and we never have.",
      "We do not show third-party advertising, and we do not share your data with advertisers or data brokers.",
      "We do not read your private drafts for our own purposes, and we do not use your books to train AI models.",
      "We do not run third-party analytics or advertising trackers on the site.",
    ],
  },
  {
    heading: "How we use what we collect",
    bullets: [
      "To run your account, keep you signed in, and show you your library.",
      "To save your place, your highlights and your drafts so they follow you between devices.",
      "To generate the text, covers and narration you ask for in the Studio.",
      "To take payment, fulfil printed book orders, and send you order updates.",
      "To answer the messages you send us and to investigate problems you report.",
      "To protect the service against abuse, fraud and unauthorised access.",
    ],
  },
  {
    heading: "Services we rely on",
    paragraphs: [
      "Lectoire is built on a small number of providers. Each receives only what it needs to do its job:",
    ],
    bullets: [
      "MongoDB Atlas — stores your account, books and library.",
      "Our hosting provider — runs the site, stores cover images, exports and audio files, and delivers our email.",
      "Stripe — processes subscription and printing payments. Stripe handles card details directly; we only receive the result.",
      "Anthropic — powers the AI writing partner. Text you send to the Studio is processed to generate your chapters.",
      "Chanova Audio — our own speech service, which turns chapter text into narration.",
    ],
  },
  {
    heading: "Cookies",
    paragraphs: [
      "Lectoire sets one cookie: a signed session cookie that keeps you logged in. It is not used for tracking or advertising, and there is nothing to opt out of. Clearing it simply signs you out.",
    ],
  },
  {
    heading: "AI and your writing",
    paragraphs: [
      "When you use the Studio, the text you provide and the chapters being written are sent to our AI provider so it can respond. Your books remain yours. Drafts stay private to your account until you choose to publish them, and publishing is always an explicit action you take.",
    ],
  },
  {
    heading: "Keeping it secure",
    bullets: [
      "Passwords are hashed, never stored in readable form.",
      "All traffic is encrypted in transit over HTTPS.",
      "Connected apps use scoped tokens that you can revoke at any time from your connections page.",
      "Access to production data is limited to what is needed to operate and support the service.",
    ],
  },
  {
    heading: "How long we keep it",
    paragraphs: [
      "We keep your account and your books for as long as your account exists. Deleting a book removes it and its chapters. Order records are kept as long as required for tax and accounting purposes. If you ask us to close your account, we delete your personal data except records we are legally required to retain.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "You can view and correct your details from your profile, download your books at any time in six formats, delete individual books, and revoke connected apps. To request a copy of your data or deletion of your account, contact us and we will action it.",
    ],
  },
  {
    heading: "Children",
    paragraphs: [
      "Lectoire is not directed at children under 13, and we do not knowingly collect their personal information. If you believe a child has created an account, contact us and we will remove it.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      `If we make a material change we will update the date at the top of this page and, where the change is significant, tell you in the app. Continuing to use Lectoire after a change means you accept the updated policy. Questions are welcome ${CONTACT_EMAIL ? `at ${CONTACT_EMAIL}` : "through the contact page"}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Lectoire holds your books, your reading and — if you order one — your address. This page explains exactly what we collect, why, and who else sees it. No legalese where plain language will do."
      sections={SECTIONS}
    />
  );
}

/**
 * The single Lectoire subscription plan.
 * Client-safe: no server-only imports (used by pages and components).
 */
export const PLAN = {
  name: "Lectoire Plus",
  priceCents: 599,
  interval: "month" as const,
  features: [
    "Create books with your AI writing partner in Studio",
    "Read the whole Lectoire library, cover to cover",
    "Write and manage your books from Claude via MCP",
    "Download your books as EPUB, PDF, DOCX and more",
    "Highlights, progress sync, and your personal library",
  ],
};

export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

export function formatPlanPrice(): string {
  return `$${(PLAN.priceCents / 100).toFixed(2)}/${PLAN.interval}`;
}

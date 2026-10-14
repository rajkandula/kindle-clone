import Stripe from "stripe";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set in .env.local.");
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Client-safe order status list — no server imports here. */
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "printing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

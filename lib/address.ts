import type { IAddress } from "./models";

/** Validate + normalize a delivery address from client input. */
export function parseAddress(raw: unknown): IAddress | null {
  const a = raw as Record<string, unknown> | null;
  const s = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const address: IAddress = {
    name: s(a?.name, 120),
    phone: s(a?.phone, 40),
    line1: s(a?.line1, 200),
    line2: s(a?.line2, 200),
    city: s(a?.city, 100),
    state: s(a?.state, 100),
    postalCode: s(a?.postalCode, 20),
    country: s(a?.country, 60),
  };
  if (!address.name || !address.line1 || !address.city || !address.postalCode || !address.country) {
    return null;
  }
  return address;
}

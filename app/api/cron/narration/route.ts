import { NextResponse } from "next/server";
import { runHousekeeping } from "@/lib/housekeeping";

export const maxDuration = 300;

/**
 * Housekeeping for work that can die silently (see lib/housekeeping.ts —
 * the server also runs it on its own timer).
 *
 * Guarded by CRON_SECRET rather than a session: it is called by a scheduler,
 * and it moves money, so it must not be reachable by anyone who finds the URL.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await runHousekeeping());
}

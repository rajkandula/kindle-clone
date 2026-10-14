/**
 * Housekeeping for work that can die silently: narrations, payouts and
 * drawings that a restart killed mid-flight. None of these have anyone
 * watching them — a render killed by a restart used to sit "preparing"
 * forever — so something has to come looking.
 *
 * Two ways in, same work:
 * - in-process: `startHousekeeping()` (called from instrumentation.ts) runs a
 *   tick every HOUSEKEEPING_INTERVAL_MINUTES (default 15, 0 turns it off) in
 *   a production server;
 * - external: `POST /api/cron/narration` with `Authorization: Bearer
 *   $CRON_SECRET`, for any scheduler you prefer.
 *
 * Every step is safe to repeat (payouts carry Stripe idempotency keys), so
 * several server instances ticking independently do no harm.
 */
import { connectDB } from "./db";
import { adoptCatalogueAudio, resumeStalledNarrations } from "./audiobook";
import { resumePendingPayouts } from "./earnings";
import { resumeIllustrationJobs } from "./illustration";

export async function runHousekeeping() {
  await connectDB();
  const [narration, adopted, payouts, drawings] = await Promise.all([
    resumeStalledNarrations(),
    // Free: claims audio the service already holds but this database lost track of.
    adoptCatalogueAudio(),
    resumePendingPayouts(),
    resumeIllustrationJobs(),
  ]);
  return {
    narration,
    adopted,
    payoutsResumed: payouts,
    drawingsResumed: drawings,
  };
}

const globalWithTimer = globalThis as typeof globalThis & {
  _housekeepingTimer?: ReturnType<typeof setInterval>;
};

/** Start the in-process tick once per server process. */
export function startHousekeeping(): void {
  if (globalWithTimer._housekeepingTimer) return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.MONGODB_URI) return;

  const minutes = Number(process.env.HOUSEKEEPING_INTERVAL_MINUTES ?? 15);
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  let running = false;
  const tick = async () => {
    if (running) return; // a slow sweep must not overlap the next one
    running = true;
    try {
      await runHousekeeping();
    } catch (err) {
      console.error("housekeeping failed:", err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, minutes * 60_000);
  // Never keep the process alive just for housekeeping.
  timer.unref?.();
  globalWithTimer._housekeepingTimer = timer;
}

/**
 * Runs once when the Next.js server starts. Lectoire uses it to start the
 * housekeeping tick (lib/housekeeping.ts) in the Node.js runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startHousekeeping } = await import("./lib/housekeeping");
    startHousekeeping();
  }
}

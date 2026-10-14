import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, FOUNDING_SPOTS, FOUNDING_MONTHS } from "@/lib/models";

export const dynamic = "force-dynamic";

/** How many launch spots are left. Public — it's the offer itself. */
export async function GET() {
  await connectDB();
  const claimed = await User.countDocuments({ foundingMember: true });
  return NextResponse.json({
    spots: FOUNDING_SPOTS,
    claimed,
    remaining: Math.max(0, FOUNDING_SPOTS - claimed),
    months: FOUNDING_MONTHS,
  });
}

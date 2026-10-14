import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { User } from "@/lib/models";
import { parseAddress } from "@/lib/address";

/** Update the user's profile. Body: { name? , address? } */
export async function PATCH(req: Request) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    update.name = name;
  }
  if (body?.address !== undefined) {
    const address = parseAddress(body.address);
    if (!address) {
      return NextResponse.json(
        { error: "Address needs at least name, street, city, postal code, and country." },
        { status: 400 }
      );
    }
    update.savedAddress = address;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await connectDB();
  await User.updateOne({ _id: userId }, { $set: update });
  return NextResponse.json({ ok: true });
}

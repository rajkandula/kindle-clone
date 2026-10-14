import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User, FOUNDING_SPOTS, FOUNDING_MONTHS } from "@/lib/models";
import { InviteView } from "@/components/InviteView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite a friend" };

export default async function InvitePage() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  await connectDB();
  const claimed = await User.countDocuments({ foundingMember: true });
  const remaining = Math.max(0, FOUNDING_SPOTS - claimed);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 sm:px-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Invite a friend</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
        Copy the message below and send it to someone who&apos;d enjoy Lectoire.
      </p>

      {remaining > 0 && (
        <p className="mt-4 inline-block rounded-full border border-accent bg-accent-soft px-4 py-1.5 text-sm font-medium text-accent-deep">
          {remaining} of {FOUNDING_SPOTS} launch spots left — they get Plus free for{" "}
          {FOUNDING_MONTHS === 1 ? "a month" : `${FOUNDING_MONTHS} months`}
        </p>
      )}

      <div className="mt-7">
        <InviteView username={user.username} />
      </div>
    </div>
  );
}

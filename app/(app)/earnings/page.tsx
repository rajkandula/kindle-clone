import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth";
import { EarningsView } from "@/components/EarningsView";

export const metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login?next=/earnings");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Earnings</h1>
      <p className="mt-2 mb-8 max-w-xl text-[15px] leading-relaxed text-muted">
        What your books have earned, and where the money goes. You keep 70% of every
        sale after card fees.
      </p>
      <EarningsView />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in" };

/** Only allow same-site return paths — never absolute URLs. */
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);
  const user = await getVerifiedUser();
  if (user) redirect(target ?? "/home");
  return <AuthForm mode="login" next={target ?? undefined} />;
}

import { redirect } from "next/navigation";
import { BookOpenText, PenLine, ShieldCheck, Store } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { OAuthClient } from "@/lib/models";
import { Logo } from "@/components/Logo";
import { OAuthConsent } from "@/components/OAuthConsent";

export const metadata = { title: "Authorize · Lectoire" };
export const dynamic = "force-dynamic";

interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
}

function Problem({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-book-sm">
        <Logo className="mx-auto mb-3 h-10 w-10" />
        <h1 className="font-display text-xl font-semibold">Can&apos;t authorize</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
      </div>
    </main>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<AuthorizeParams>;
}) {
  const params = await searchParams;
  const user = await getVerifiedUser();

  if (!user) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][]
    ).toString();
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }

  const {
    response_type,
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
  } = params;

  if (response_type !== "code") {
    return <Problem text="This sign-in request is malformed (response_type must be “code”)." />;
  }
  if (!client_id || !redirect_uri || !code_challenge) {
    return <Problem text="This sign-in request is missing required fields — go back to Claude and try connecting again." />;
  }
  if (code_challenge_method && code_challenge_method !== "S256") {
    return <Problem text="Unsupported code challenge method — only S256 is allowed." />;
  }

  await connectDB();
  const client = await OAuthClient.findOne({ clientId: client_id });
  if (!client) {
    return <Problem text="Unknown app — go back to Claude and try connecting again." />;
  }
  if (!client.redirectUris.includes(redirect_uri)) {
    return <Problem text="The app's return address doesn't match its registration — connection refused for your safety." />;
  }

  const PERMS = [
    { icon: PenLine, text: "Create and edit your books and chapters" },
    { icon: Store, text: "Publish to and unpublish from the store" },
    { icon: BookOpenText, text: "Browse and read published books" },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="mb-3 h-12 w-12 drop-shadow-sm" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Connect {client.name} to Lectoire
          </h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="font-semibold">@{user!.username}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-semibold text-ink">{client.name}</span> is asking to
            access your Lectoire library:
          </p>
          <ul className="mt-4 space-y-3">
            {PERMS.map((p) => (
              <li key={p.text} className="flex items-start gap-3 text-sm">
                <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {p.text}
              </li>
            ))}
          </ul>

          <OAuthConsent
            request={{
              client_id,
              redirect_uri,
              state: state ?? "",
              code_challenge,
              scope: scope ?? "",
            }}
          />

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            You can disconnect this app anytime from your Connections page. It never
            sees your password.
          </p>
        </div>
      </div>
    </main>
  );
}

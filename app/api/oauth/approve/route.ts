import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { OAuthClient, OAuthCode } from "@/lib/models";
import { newSecret } from "@/lib/oauth";

const CODE_TTL_MS = 10 * 60 * 1000;

/** The consent screen posts the user's decision here; on approval we mint a
 *  single-use authorization code and send the browser back to the app. */
export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clientId = typeof body?.client_id === "string" ? body.client_id : "";
  const redirectUri = typeof body?.redirect_uri === "string" ? body.redirect_uri : "";
  const state = typeof body?.state === "string" ? body.state : "";
  const codeChallenge = typeof body?.code_challenge === "string" ? body.code_challenge : "";
  const scope = typeof body?.scope === "string" ? body.scope.slice(0, 200) : "";
  const decision = body?.decision === "approve" ? "approve" : "deny";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing client or redirect." },
      { status: 400 }
    );
  }

  await connectDB();
  const client = await OAuthClient.findOne({ clientId });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Unknown app or return address." },
      { status: 400 }
    );
  }

  const url = new URL(redirectUri);
  if (state) url.searchParams.set("state", state);

  if (decision !== "approve") {
    url.searchParams.set("error", "access_denied");
    return NextResponse.json({ redirect: url.toString() });
  }

  if (!codeChallenge) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "PKCE challenge is required." },
      { status: 400 }
    );
  }

  const code = newSecret("embac_", 24);
  await OAuthCode.create({
    code,
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scope,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  url.searchParams.set("code", code);
  return NextResponse.json({ redirect: url.toString() });
}

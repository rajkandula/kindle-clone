import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { OAuthClient } from "@/lib/models";
import { corsHeaders, newSecret, preflight } from "@/lib/oauth";

/** Dynamic client registration (RFC 7591) — claude.ai calls this when the
 *  user clicks Connect. Registration is open; every grant still requires the
 *  user to sign in and approve on the consent screen. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const redirectUris = Array.isArray(body?.redirect_uris)
    ? body.redirect_uris.filter(
        (u: unknown): u is string =>
          typeof u === "string" &&
          (u.startsWith("https://") || u.startsWith("http://localhost"))
      )
    : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      {
        error: "invalid_client_metadata",
        error_description: "redirect_uris (https) is required.",
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  const name =
    typeof body?.client_name === "string" && body.client_name.trim()
      ? body.client_name.trim().slice(0, 120)
      : "Claude";

  await connectDB();
  const client = await OAuthClient.create({
    clientId: newSecret("embc_", 16),
    name,
    redirectUris: redirectUris.slice(0, 10),
  });

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: corsHeaders() }
  );
}

export function OPTIONS() {
  return preflight();
}

import { NextResponse } from "next/server";
import { corsHeaders, preflight, requestOrigin } from "@/lib/oauth";

/** OAuth authorization-server metadata (RFC 8414), served at
 *  /.well-known/oauth-authorization-server via a rewrite. */
export async function GET(req: Request) {
  const base = requestOrigin(req);
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["library"],
    },
    { headers: corsHeaders() }
  );
}

export function OPTIONS() {
  return preflight();
}

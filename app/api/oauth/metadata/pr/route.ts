import { NextResponse } from "next/server";
import { corsHeaders, preflight, requestOrigin } from "@/lib/oauth";

/** OAuth protected-resource metadata (RFC 9728), served at
 *  /.well-known/oauth-protected-resource via a rewrite. */
export async function GET(req: Request) {
  const base = requestOrigin(req);
  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      scopes_supported: ["library"],
    },
    { headers: corsHeaders() }
  );
}

export function OPTIONS() {
  return preflight();
}

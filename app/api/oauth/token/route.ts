import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { OAuthClient, OAuthCode, OAuthToken } from "@/lib/models";
import { corsHeaders, newSecret, preflight, verifyPkce } from "@/lib/oauth";

const YEAR_SECONDS = 365 * 24 * 60 * 60;

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: corsHeaders() }
  );
}

/** Accepts application/x-www-form-urlencoded (the OAuth standard) or JSON. */
async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body ?? {})) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const text = await req.text().catch(() => "");
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(req: Request) {
  const p = await readParams(req);
  await connectDB();

  if (p.grant_type === "authorization_code") {
    const { code, code_verifier, client_id, redirect_uri } = p;
    if (!code || !code_verifier) {
      return oauthError("invalid_request", "code and code_verifier are required.");
    }

    const stored = await OAuthCode.findOne({ code });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      return oauthError("invalid_grant", "The authorization code is invalid or expired.");
    }
    if (client_id && client_id !== stored.clientId) {
      return oauthError("invalid_grant", "Client mismatch.");
    }
    if (redirect_uri && redirect_uri !== stored.redirectUri) {
      return oauthError("invalid_grant", "redirect_uri mismatch.");
    }
    if (!verifyPkce(code_verifier, stored.codeChallenge)) {
      return oauthError("invalid_grant", "PKCE verification failed.");
    }

    stored.usedAt = new Date();
    await stored.save();

    const client = await OAuthClient.findOne({ clientId: stored.clientId });
    const grant = await OAuthToken.create({
      token: newSecret("embat_", 32),
      refreshToken: newSecret("embrt_", 32),
      userId: stored.userId,
      clientId: stored.clientId,
      clientName: client?.name ?? "Claude",
      scope: stored.scope,
    });

    return NextResponse.json(
      {
        access_token: grant.token,
        token_type: "Bearer",
        expires_in: YEAR_SECONDS,
        refresh_token: grant.refreshToken,
        scope: grant.scope,
      },
      { headers: corsHeaders() }
    );
  }

  if (p.grant_type === "refresh_token") {
    const { refresh_token } = p;
    if (!refresh_token) {
      return oauthError("invalid_request", "refresh_token is required.");
    }
    const grant = await OAuthToken.findOne({ refreshToken: refresh_token });
    if (!grant) {
      return oauthError("invalid_grant", "Unknown refresh token.");
    }

    // Rotate the access token; keep the refresh token stable
    grant.token = newSecret("embat_", 32);
    await grant.save();

    return NextResponse.json(
      {
        access_token: grant.token,
        token_type: "Bearer",
        expires_in: YEAR_SECONDS,
        refresh_token: grant.refreshToken,
        scope: grant.scope,
      },
      { headers: corsHeaders() }
    );
  }

  return oauthError(
    "unsupported_grant_type",
    "Use authorization_code or refresh_token."
  );
}

export function OPTIONS() {
  return preflight();
}

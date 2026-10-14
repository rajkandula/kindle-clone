import { createHash, randomBytes } from "node:crypto";
import { OAuthToken, User } from "./models";
import type mongoose from "mongoose";

/** Random URL-safe id with a recognizable prefix. */
export function newSecret(prefix: string, bytes = 24): string {
  return prefix + randomBytes(bytes).toString("base64url");
}

/** PKCE S256: does sha256(verifier) match the stored challenge? */
export function verifyPkce(verifier: string, challenge: string): boolean {
  const digest = createHash("sha256").update(verifier).digest("base64url");
  return digest === challenge;
}

/** The public origin of this deployment, derived from the incoming request. */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  // Behind a reverse proxy the original host arrives via headers
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** CORS for the OAuth + MCP endpoints (claude.ai calls these cross-origin). */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
    "Access-Control-Max-Age": "86400",
  };
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/**
 * Resolve a bearer token (personal `emb_…` token or an OAuth access token)
 * to a user id. Used by the MCP transport on every request.
 */
export async function resolveBearerUserId(
  token: string
): Promise<mongoose.Types.ObjectId | null> {
  if (!token) return null;
  const legacy = await User.findOne({ mcpToken: token }).select("_id");
  if (legacy) return legacy._id;
  const grant = await OAuthToken.findOne({ token }).select("_id userId");
  if (grant) {
    OAuthToken.updateOne({ _id: grant._id }, { $set: { lastUsedAt: new Date() } }).catch(
      () => {}
    );
    return grant.userId;
  }
  return null;
}

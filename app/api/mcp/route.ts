import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { executeMcpTool, MCP_INSTRUCTIONS, MCP_TOOLS } from "@/lib/mcp-server";
import { corsHeaders, preflight, requestOrigin, resolveBearerUserId } from "@/lib/oauth";

export const maxDuration = 60;

/**
 * The Lectoire MCP server: a stateless MCP endpoint over Streamable HTTP.
 * Each POST carries one JSON-RPC message; we respond with a single JSON
 * body (the spec's stateless mode — no session, no SSE stream needed).
 *
 * Auth: `Authorization: Bearer …` — either the personal `emb_…` token from
 * /connections, or an OAuth access token issued to a connected Claude app.
 * 401 responses advertise the OAuth sign-in service so claude.ai can start
 * the connect flow automatically.
 */

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: number | string | null, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: number | string | null, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function unauthorized(req: Request, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32600, message } },
    {
      status: 401,
      headers: {
        ...corsHeaders(),
        "WWW-Authenticate": `Bearer resource_metadata="${requestOrigin(req)}/.well-known/oauth-protected-resource"`,
      },
    }
  );
}

async function handleMessage(
  msg: JsonRpcMessage,
  token: string
): Promise<Record<string, unknown> | null> {
  const id = msg.id ?? null;

  // Notifications (no id) get no response body
  if (msg.id === undefined || msg.id === null) return null;

  switch (msg.method) {
    case "initialize": {
      const requested =
        typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested)
          ? requested
          : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "Lectoire", version: "1.0.0" },
        instructions: MCP_INSTRUCTIONS,
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: MCP_TOOLS });

    case "tools/call": {
      const name = typeof msg.params?.name === "string" ? msg.params.name : "";
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      // Re-verify per call — the token or grant may have been revoked mid-session
      const userId = await resolveBearerUserId(token);
      const user = userId ? await User.findById(userId) : null;
      if (!user) {
        return rpcError(id, -32600, "Access token revoked.");
      }
      try {
        const result = await executeMcpTool(user, name, args);
        return rpcResult(id, {
          content: [{ type: "text", text: result.text }],
          isError: result.isError ?? false,
        });
      } catch (err) {
        console.error(`mcp tool ${name} failed:`, err);
        return rpcResult(id, {
          content: [{ type: "text", text: "The tool hit an internal error — try again." }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  // --- authenticate ---
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return unauthorized(req, "Missing bearer token.");

  await connectDB();
  const userId = await resolveBearerUserId(token);
  if (!userId) return unauthorized(req, "Invalid access token.");

  // --- parse ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // --- dispatch (single message or batch) ---
  if (Array.isArray(body)) {
    const responses = (
      await Promise.all(body.map((m) => handleMessage(m as JsonRpcMessage, token)))
    ).filter((r): r is Record<string, unknown> => r !== null);
    if (responses.length === 0) return new Response(null, { status: 202, headers: corsHeaders() });
    return NextResponse.json(responses, { headers: corsHeaders() });
  }

  const response = await handleMessage(body as JsonRpcMessage, token);
  if (response === null) return new Response(null, { status: 202, headers: corsHeaders() });
  return NextResponse.json(response, { headers: corsHeaders() });
}

/** Stateless server: no SSE stream to resume, no session to delete. */
export async function GET() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", ...corsHeaders() },
  });
}

export async function DELETE() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", ...corsHeaders() },
  });
}

export function OPTIONS() {
  return preflight();
}

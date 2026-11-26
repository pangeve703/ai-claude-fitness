import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { MissingApiKeyError } from "@/lib/claude";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Bring-your-own-key (BYOK) support.
 *
 * The browser keeps the visitor's Anthropic key in localStorage and sends it on
 * every AI request in this header. The server uses it only for that request;
 * it is never logged or written to the database. If the header is absent the
 * server falls back to its own ANTHROPIC_API_KEY (see getClient in lib/claude.ts).
 */
export const API_KEY_HEADER = "x-anthropic-api-key";

export function getRequestApiKey(req: Request): string | null {
  const key = req.headers.get(API_KEY_HEADER)?.trim();
  if (!key) return null;
  // Cheap sanity check so obviously wrong input fails fast with a clear message.
  if (!key.startsWith("sk-ant-") || key.length > 300) return null;
  return key;
}

export function hasServerApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Maps Anthropic SDK errors to JSON responses with messages in the visitor's
 * language. Uses the SDK's typed error classes, never message matching.
 */
export function aiErrorResponse(err: unknown, t: Dictionary, fallback: string): NextResponse {
  const e = t.errors;
  if (err instanceof MissingApiKeyError) {
    return NextResponse.json({ error: e.missingKey, code: "missing_api_key" }, { status: 401 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ error: e.invalidKey, code: "invalid_api_key" }, { status: 401 });
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return NextResponse.json({ error: e.permissionDenied, code: "permission_denied" }, { status: 403 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: e.rateLimited, code: "rate_limited" }, { status: 429 });
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error:", err.status, err.message);
    return NextResponse.json({ error: e.withDetail(fallback, err.message) }, { status: 502 });
  }
  console.error(fallback, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

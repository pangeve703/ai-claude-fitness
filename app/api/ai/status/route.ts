import { NextResponse } from "next/server";
import { getClient } from "@/lib/claude";
import { aiErrorResponse, getRequestApiKey, hasServerApiKey } from "@/lib/api-key";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** GET: tells the UI whether the server has its own key (so BYOK is optional). */
export async function GET() {
  return NextResponse.json({ serverKeyConfigured: hasServerApiKey() });
}

/**
 * POST: verifies the key sent in the x-anthropic-api-key header.
 * Listing models is free (no tokens billed), so it's a safe key check.
 */
export async function POST(req: Request) {
  const t = await getDictionary();
  const apiKey = getRequestApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: t.errors.keyFormat }, { status: 400 });
  }
  try {
    await getClient(apiKey).models.list({ limit: 1 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return aiErrorResponse(err, t, t.errors.verifyFailed);
  }
}

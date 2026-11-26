import { NextResponse } from "next/server";
import { analyzeImage, analyzeTextEntry } from "@/lib/claude";
import { aiErrorResponse, getRequestApiKey } from "@/lib/api-key";
import { getDictionary } from "@/lib/i18n/server";

export const runtime = "nodejs";
// Vision calls can take 10–30s.
export const maxDuration = 60;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
// The client downsizes photos before upload; this guards against oversized bodies.
const MAX_IMAGE_BASE64_LENGTH = 4_000_000;

/**
 * Web equivalent of sending a photo or a text message to the Telegram bot.
 * Body: { text } or { imageBase64, mimeType, caption? }.
 * Returns the AI analysis only; the client confirms before anything is saved.
 */
export async function POST(req: Request) {
  const t = await getDictionary();
  const e = t.errors;
  let body: { text?: string; imageBase64?: string; mimeType?: string; caption?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: e.badRequest }, { status: 400 });
  }

  const apiKey = getRequestApiKey(req);

  try {
    if (body.imageBase64) {
      const mimeType = body.mimeType || "image/jpeg";
      if (!IMAGE_TYPES.includes(mimeType)) {
        return NextResponse.json({ error: e.imageType }, { status: 400 });
      }
      if (body.imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: e.imageTooLarge }, { status: 413 });
      }
      const result = await analyzeImage(body.imageBase64, mimeType, body.caption, { apiKey, locale: t.locale });
      return NextResponse.json({ result });
    }

    const text = body.text?.trim();
    if (!text) return NextResponse.json({ error: e.emptyInput }, { status: 400 });
    if (text.length > 1000) return NextResponse.json({ error: e.textTooLong }, { status: 400 });

    const result = await analyzeTextEntry(text, { apiKey, locale: t.locale });
    return NextResponse.json({ result });
  } catch (err) {
    return aiErrorResponse(err, t, e.analyzeFailed);
  }
}

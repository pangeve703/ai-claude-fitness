import { after, NextResponse } from "next/server";
import { getBot, awaitInFlight } from "@/lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vision/text analysis via Claude can take 10–30s. 60s is the max on Vercel
// Hobby; raise on Pro if you have a higher limit.
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch (err) {
    console.error("Webhook JSON parse error:", err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Kick off the handlers (synchronous dispatch into bot's EventEmitter).
  // The actual handler bodies run async and are tracked via track() in
  // lib/telegram-bot.ts, so we can await them with awaitInFlight().
  try {
    getBot().processUpdate(update as Parameters<ReturnType<typeof getBot>["processUpdate"]>[0]);
  } catch (err) {
    console.error("processUpdate error:", err);
  }

  // Return 200 to Telegram immediately so it doesn't retry. after() keeps the
  // serverless function alive (up to maxDuration) until the handler promises
  // settle, so editMessageText calls reach Telegram before suspension.
  after(awaitInFlight);

  return NextResponse.json({ ok: true });
}

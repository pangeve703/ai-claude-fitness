export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// Called on first request to initialize the Telegram bot
let initialized = false;

export async function GET() {
  if (!initialized) {
    initialized = true;
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const { getBot } = await import("@/lib/telegram-bot");
      getBot();
    }
  }
  return NextResponse.json({ ok: true });
}

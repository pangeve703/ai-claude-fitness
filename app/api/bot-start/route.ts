import { NextResponse } from "next/server";

let initialized = false;

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST() {
  if (!initialized && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      initialized = true;
      const { getBot } = await import("@/lib/telegram-bot");
      getBot();
    } catch (err) {
      console.warn("Failed to initialize Telegram bot:", err);
    }
  }
  return NextResponse.json({ status: "running" });
}

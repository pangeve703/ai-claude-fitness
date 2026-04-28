import { NextResponse } from "next/server";
import { getBot } from "@/lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    const update = await request.json();
    getBot().processUpdate(update);
  } catch (err) {
    console.error("Webhook processing error:", err);
  }

  return NextResponse.json({ ok: true });
}

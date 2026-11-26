import { getEnvBotConfig } from "@/lib/bot-config";
import { handleTelegramWebhook } from "@/lib/telegram-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vision/text analysis via Claude can take 10–30s. 60s is the max on Vercel Hobby.
export const maxDuration = 60;

/** Webhook for the bot configured through env vars (TELEGRAM_BOT_TOKEN), owned by TELEGRAM_OWNER_USER_ID. */
export async function POST(request: Request) {
  return handleTelegramWebhook(request, getEnvBotConfig());
}

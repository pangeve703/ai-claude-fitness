import { getAppBotConfig } from "@/lib/bot-config";
import { handleTelegramWebhook } from "@/lib/telegram-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Webhook for a bot a user connected in the app. `botId` is BotConfig.id (random, unguessable). */
export async function POST(request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  if (!/^[a-f0-9]{24}$/.test(botId)) return new Response(null, { status: 404 });
  return handleTelegramWebhook(request, await getAppBotConfig(botId));
}

import { after, NextResponse } from "next/server";
import { getBot, awaitInFlight } from "./telegram-bot";
import type { BotRuntimeConfig } from "./bot-config";
import { checkChatAccess, extractChat } from "./telegram-access";
import { prisma } from "./prisma";

const PRIVATE_BOT_REPLY = "🔒 This bot is private and linked to another account.\n🔒 这个机器人是私人的，已绑定其他账户。";

/**
 * Shared webhook handling for env-configured and app-connected bots:
 * check Telegram's secret header, dispatch the update, return 200 at once,
 * and keep the function alive with after() until the handlers finish.
 */
export async function handleTelegramWebhook(request: Request, config: BotRuntimeConfig | null) {
  // 404 rather than 401 for an unknown bot, so ids can't be probed.
  if (!config) return NextResponse.json({ ok: false }, { status: 404 });

  if (config.webhookSecret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== config.webhookSecret) {
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

  // Only the owner's chat may use the bot (see lib/telegram-access.ts).
  const chat = extractChat(update);
  const access = checkChatAccess(config.chatLock, chat);
  if (access === "claim" && config.chatLock.kind === "claimable") {
    // Atomic: if two chats race, only the first one wins the bot.
    const { count } = await prisma.botConfig.updateMany({
      where: { id: config.chatLock.botId, chatId: null },
      data: { chatId: chat!.id },
    });
    if (count === 0) return deny(config, chat);
  } else if (access === "deny") {
    return deny(config, chat);
  }

  // processUpdate dispatches synchronously into the bot's EventEmitter; the
  // async handler bodies are tracked by track() in lib/telegram-bot.ts.
  try {
    getBot(config).processUpdate(update as Parameters<ReturnType<typeof getBot>["processUpdate"]>[0]);
  } catch (err) {
    console.error("processUpdate error:", err);
  }

  // Reply 200 so Telegram doesn't retry; after() keeps the serverless function
  // alive (up to maxDuration) until the handlers' replies reach Telegram.
  after(awaitInFlight);
  return NextResponse.json({ ok: true });
}

/** Ignore the update (200, so Telegram doesn't retry); tell a stranger in a private chat why. */
async function deny(config: BotRuntimeConfig, chat: ReturnType<typeof extractChat>) {
  if (chat?.isMessage && chat.type === "private") {
    await getBot(config).sendMessage(Number(chat.id), PRIVATE_BOT_REPLY).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

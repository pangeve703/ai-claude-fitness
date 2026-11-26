import { prisma } from "./prisma";
import { decryptSecret } from "./crypto";
import { parseAllowedChatIds, type ChatLock } from "./telegram-access";

/**
 * Where a Telegram bot's secrets come from:
 *   - "app": a user connected it in the app. Stored encrypted in BotConfig,
 *     reached at /api/telegram/webhook/<BotConfig.id>.
 *   - "env": TELEGRAM_BOT_TOKEN etc., reached at /api/telegram/webhook and
 *     owned by TELEGRAM_OWNER_USER_ID (default 1, the original profile).
 * Read on every webhook call (one indexed query), so a newly connected bot
 * works on every serverless instance immediately.
 */
export interface BotRuntimeConfig {
  token: string;
  webhookSecret: string | null;
  anthropicKey: string | null;
  /** The user whose data this bot reads and writes. */
  userId: number;
  source: "app" | "env";
  /** Which Telegram chats it may serve (see lib/telegram-access.ts). */
  chatLock: ChatLock;
}

export function envBotOwnerId(): number {
  return Number(process.env.TELEGRAM_OWNER_USER_ID) || 1;
}

export async function getAppBotConfig(id: string): Promise<BotRuntimeConfig | null> {
  const row = await prisma.botConfig.findUnique({ where: { id } });
  if (!row) return null;
  return {
    token: decryptSecret(row.telegramTokenEnc),
    webhookSecret: decryptSecret(row.webhookSecretEnc),
    anthropicKey: row.anthropicKeyEnc ? decryptSecret(row.anthropicKeyEnc) : process.env.ANTHROPIC_API_KEY ?? null,
    userId: row.userId,
    source: "app",
    chatLock: row.chatId ? { kind: "fixed", chatIds: [row.chatId] } : { kind: "claimable", botId: row.id },
  };
}

function envChatLock(): ChatLock {
  const ids = parseAllowedChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
  return ids ? { kind: "fixed", chatIds: ids } : { kind: "open" };
}

export function getEnvBotConfig(): BotRuntimeConfig | null {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? null,
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? null,
    userId: envBotOwnerId(),
    source: "env",
    chatLock: envChatLock(),
  };
}

/** Connection status of `userId`'s bot, for the UI. Never decrypts or returns a secret. */
export async function getBotStatus(userId: number): Promise<{
  connected: boolean;
  source: "app" | "env" | null;
  username: string | null;
  usesOwnAnthropicKey: boolean;
  /** Whether the bot is locked to its owner's chat. */
  chatLocked: boolean;
}> {
  const row = await prisma.botConfig.findUnique({ where: { userId } });
  if (row) {
    return {
      connected: true,
      source: "app",
      username: row.botUsername,
      usesOwnAnthropicKey: !!row.anthropicKeyEnc,
      chatLocked: !!row.chatId,
    };
  }
  if (process.env.TELEGRAM_BOT_TOKEN && userId === envBotOwnerId()) {
    return {
      connected: true,
      source: "env",
      username: null,
      usesOwnAnthropicKey: false,
      chatLocked: envChatLock().kind === "fixed",
    };
  }
  return { connected: false, source: null, username: null, usesOwnAnthropicKey: false, chatLocked: false };
}

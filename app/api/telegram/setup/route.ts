import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, hasAppSecret } from "@/lib/crypto";
import { getBotStatus } from "@/lib/bot-config";
import { BOT_TOKEN_PATTERN, telegramApi, TelegramApiError } from "@/lib/telegram-api";
import { getRequestApiKey, hasServerApiKey } from "@/lib/api-key";
import { getDictionary } from "@/lib/i18n/server";
import { apiUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the current user's bot status (no secrets). */
export async function GET() {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  return NextResponse.json(await getBotStatus(auth.user.id));
}

/**
 * POST { botToken } with the visitor's Anthropic key in x-anthropic-api-key.
 * Unlike the Anthropic key on the web, the bot's secrets must live on the
 * server: Telegram calls our webhook directly, with no browser involved.
 *   1. verify the token with Telegram (getMe)
 *   2. register /api/telegram/webhook/<random id> with a fresh random secret_token
 *   3. store token, webhook secret and Anthropic key, all encrypted
 */
export async function POST(req: Request) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const userId = auth.user.id;
  const t = await getDictionary();
  const e = t.errors;

  if (!hasAppSecret()) return NextResponse.json({ error: e.appSecretMissing }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { botToken?: string } | null;
  const botToken = body?.botToken?.trim() ?? "";
  if (!BOT_TOKEN_PATTERN.test(botToken)) return NextResponse.json({ error: e.botTokenFormat }, { status: 400 });

  const anthropicKey = getRequestApiKey(req);
  if (!anthropicKey && !hasServerApiKey()) {
    return NextResponse.json({ error: e.botNeedsAnthropicKey }, { status: 400 });
  }

  const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  if (!base.startsWith("https://")) {
    return NextResponse.json({ error: e.webhookNeedsHttps(base) }, { status: 400 });
  }

  try {
    const me = await telegramApi<{ username?: string }>(botToken, "getMe");

    // If this user had a different bot before, detach its webhook (best effort).
    const previous = await prisma.botConfig.findUnique({ where: { userId } });
    if (previous) {
      const oldToken = decryptSecret(previous.telegramTokenEnc);
      if (oldToken !== botToken) await telegramApi(oldToken, "deleteWebhook").catch(() => {});
    }

    // Random id → unguessable per-bot webhook URL. Kept stable across reconnects.
    const id = previous?.id ?? randomBytes(12).toString("hex");
    const webhookUrl = `${base}/api/telegram/webhook/${id}`;
    const webhookSecret = randomBytes(32).toString("hex");
    await telegramApi(botToken, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });

    const data = {
      telegramTokenEnc: encryptSecret(botToken),
      webhookSecretEnc: encryptSecret(webhookSecret),
      anthropicKeyEnc: anthropicKey ? encryptSecret(anthropicKey) : null,
      botUsername: me.username ?? null,
      // (Re)connecting resets the chat lock: the next private chat to message the bot claims it.
      chatId: null,
    };
    await prisma.botConfig.upsert({ where: { userId }, create: { id, userId, ...data }, update: data });

    return NextResponse.json(await getBotStatus(userId));
  } catch (err) {
    if (err instanceof TelegramApiError) {
      const invalid = err.code === 401 || err.code === 404;
      return NextResponse.json(
        { error: invalid ? e.botTokenInvalid : e.withDetail(e.telegramFailed, err.message) },
        { status: invalid ? 400 : 502 }
      );
    }
    console.error("Telegram setup failed:", err);
    return NextResponse.json({ error: e.telegramFailed }, { status: 500 });
  }
}

/** DELETE: detach the webhook and forget the current user's bot (app-connected bots only). */
export async function DELETE() {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const userId = auth.user.id;
  const t = await getDictionary();
  const row = await prisma.botConfig.findUnique({ where: { userId } });
  if (!row) {
    const status = await getBotStatus(userId);
    if (status.source === "env") return NextResponse.json({ error: t.errors.botManagedByEnv }, { status: 400 });
    return NextResponse.json(status);
  }
  try {
    await telegramApi(decryptSecret(row.telegramTokenEnc), "deleteWebhook");
  } catch (err) {
    console.warn("deleteWebhook failed (continuing):", (err as Error).message);
  }
  await prisma.botConfig.delete({ where: { userId } });
  return NextResponse.json(await getBotStatus(userId));
}

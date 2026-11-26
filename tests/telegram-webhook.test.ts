import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BotRuntimeConfig } from "@/lib/bot-config";

const bot = { processUpdate: vi.fn(), sendMessage: vi.fn(async () => ({})) };
const db = { botConfig: { updateMany: vi.fn() } };

vi.mock("@/lib/telegram-bot", () => ({ getBot: () => bot, awaitInFlight: async () => {} }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: vi.fn() }));

const { handleTelegramWebhook } = await import("@/lib/telegram-webhook");

const config = (chatLock: BotRuntimeConfig["chatLock"]): BotRuntimeConfig => ({
  token: "t",
  webhookSecret: "s3cret",
  anthropicKey: null,
  userId: 7,
  source: "app",
  chatLock,
});
const update = (chatId: number, type = "private") => ({ update_id: 1, message: { chat: { id: chatId, type }, text: "hi" } });
const post = (body: unknown, secret = "s3cret") =>
  new Request("http://x/api/telegram/webhook/abc", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe("telegram webhook", () => {
  it("rejects calls without Telegram's secret", async () => {
    const res = await handleTelegramWebhook(post(update(42), "wrong"), config({ kind: "open" }));
    expect(res.status).toBe(401);
    expect(bot.processUpdate).not.toHaveBeenCalled();
  });

  it("404s for an unknown bot", async () => {
    expect((await handleTelegramWebhook(post(update(42)), null)).status).toBe(404);
  });

  it("lets the first private chat claim the bot, atomically", async () => {
    db.botConfig.updateMany.mockResolvedValue({ count: 1 });
    await handleTelegramWebhook(post(update(42)), config({ kind: "claimable", botId: "abc" }));
    expect(db.botConfig.updateMany).toHaveBeenCalledWith({ where: { id: "abc", chatId: null }, data: { chatId: "42" } });
    expect(bot.processUpdate).toHaveBeenCalled();
  });

  it("loses a claim race gracefully", async () => {
    db.botConfig.updateMany.mockResolvedValue({ count: 0 });
    await handleTelegramWebhook(post(update(42)), config({ kind: "claimable", botId: "abc" }));
    expect(bot.processUpdate).not.toHaveBeenCalled();
  });

  it("ignores strangers once locked, and tells them why", async () => {
    const res = await handleTelegramWebhook(post(update(99)), config({ kind: "fixed", chatIds: ["42"] }));
    expect(res.status).toBe(200); // 200 so Telegram doesn't retry
    expect(bot.processUpdate).not.toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledWith(99, expect.stringContaining("private"));
  });

  it("stays silent in groups", async () => {
    await handleTelegramWebhook(post(update(-5, "group")), config({ kind: "fixed", chatIds: ["42"] }));
    expect(bot.sendMessage).not.toHaveBeenCalled();
    expect(bot.processUpdate).not.toHaveBeenCalled();
  });

  it("serves the owner's chat", async () => {
    await handleTelegramWebhook(post(update(42)), config({ kind: "fixed", chatIds: ["42"] }));
    expect(bot.processUpdate).toHaveBeenCalled();
  });
});

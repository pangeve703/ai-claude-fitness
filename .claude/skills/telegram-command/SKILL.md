---
name: telegram-command
description: Add or change a Telegram bot command, callback button, or photo/text handler in lib/telegram-bot.ts. Use for any bot behaviour change; covers the serverless webhook constraints that make naive handlers silently drop replies.
---

# Telegram bot handlers

The bot runs in **webhook mode on serverless functions**:
`POST /api/telegram/webhook/<id>` → `getAppBotConfig(id)` (that user's encrypted `BotConfig`; `/api/telegram/webhook` is the env-var bot) → `handleTelegramWebhook()` → `getBot(config).processUpdate(update)` → handlers registered in `setupHandlers()` in `lib/telegram-bot.ts`. The bot is usually connected from the app (`/api/telegram/setup`), so never read `process.env.TELEGRAM_BOT_TOKEN` directly. The route returns 200 straight away and `after(awaitInFlight)` keeps the function alive until the tracked handlers finish (up to `maxDuration = 60`s).

## Rules

1. **Wrap every handler in `track()`**, or the function may be frozen before the reply is sent:
   ```ts
   bot.onText(/^\/streak(?:@\w+)?$/, track(async (msg) => {
     const chatId = msg.chat.id;
     try {
       // ...
       await bot.sendMessage(chatId, "…");
     } catch (err) {
       console.error("Error in /streak handler:", err);
       await bot.sendMessage(chatId, "出错了，请稍后再试");
     }
   }));
   ```
2. **Anchor command regexes** (`^\/cmd(?:@\w+)?`) so `/today` doesn't also match `/todays`, and so they work in groups (`/cmd@BotName`).
3. The generic `bot.on("message")` handler treats any text not starting with `/` as a food or workout entry (it returns early on `msg.text?.startsWith("/")` and photos). New commands must start with `/`, or they'll also be logged as food.
4. Handlers only ever see the owner's chat: `handleTelegramWebhook()` applies the chat lock (`lib/telegram-access.ts`) before `processUpdate`. Don't add per-handler chat checks, and don't bypass the shared webhook handler.
5. **Scope every query to `ctx.userId`** (the bot's owner), including lookups by id from callback data, e.g. `findFirst({ where: { id, userId: ctx.userId } })`.
6. Use the app time zone helpers (`getTodayString()`, `getHourInAppTimeZone()`), not `new Date().toISOString()`, for "today".
7. For long Claude calls, send a "分析中…" ("analysing…") message first and `editMessageText` it with the result, like the photo handler does.
8. Claude calls go through `lib/claude.ts` with `{ apiKey: ctx.apiKey }`: the Anthropic key stored when the bot was connected, or the server key. Catch `MissingApiKeyError` and reply with a helpful message.
9. `callback_data` is limited to 64 bytes. Keep payloads short (`df:<id>`), not whole objects.
10. Add the new command to both the `/start` and `/help` texts.

## Testing without Telegram

Post a fake update to a running dev server (needs a configured bot, from the app or `TELEGRAM_BOT_TOKEN`; include the webhook secret header if one is set; replies will fail to send, but the handler runs and logs):

```bash
curl -s -X POST localhost:3000/api/telegram/webhook -H 'content-type: application/json' \
  -d '{"update_id":1,"message":{"message_id":1,"date":0,"chat":{"id":1,"type":"private"},"text":"/help"}}'
```

Check the dev server log for handler errors. Testing for real requires a deployed URL and `setWebhook` (see the README).

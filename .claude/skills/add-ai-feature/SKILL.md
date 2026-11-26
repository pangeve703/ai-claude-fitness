---
name: add-ai-feature
description: Add or change a Claude-powered capability in this app (new prompt, new analysis type, new AI endpoint or UI that calls Claude). Use whenever work touches lib/claude.ts, an /api route that calls Claude, or a component that triggers an AI request, so the feature keeps bring-your-own-key support and the project's prompt/JSON conventions.
---

# Adding an AI feature

Every Claude call in this app follows one path. Keep it that way so bring-your-own-key (BYOK) and error handling keep working.

```
Client component ──aiHeaders()──▶ app/api/<route>/route.ts ──{ apiKey }──▶ lib/claude.ts fn ──getClient(apiKey)──▶ Claude
```

## 1. Prompt function in `lib/claude.ts`

- Signature ends with `opts: ClaudeOptions = {}` and calls `getClient(opts.apiKey).messages.create(...)`. Never construct `new Anthropic()` anywhere else.
- Use `FAST_MODEL` (`claude-haiku-4-5`) unless there is a measured reason to change it; visitors pay with their own keys.
- System prompt pattern: `` `你是…。${languageRule(opts.locale)} 只输出 JSON 不要其他文字。` ``. `languageRule` sets the output language; don't hard-code "用中文回复". Put the exact JSON shape in the user prompt.
- If the UI interprets a value (a category, a level), make it a fixed English enum in the JSON shape (`"intensity":"low|medium|high"`) and translate it in the UI, never by asking Claude for display text.
- Parse with the existing pattern: `text.match(/\{[\s\S]*\}/)` → `JSON.parse` inside `try`, returning a safe fallback (e.g. `{ type: "unknown" }`) on failure. Export a TypeScript type for the result.
- **Keep arithmetic in code.** If the feature involves maths (portion splitting, TDEE, unit conversion), have Claude return raw values and compute in TypeScript, like `getServingDivisor` / `divideFoodResult` and `calcTDEE`.

## 2. Route handler

```ts
import { aiErrorResponse, getRequestApiKey } from "@/lib/api-key";

export const runtime = "nodejs";
export const maxDuration = 60; // vision/long generations take 10–30s

export async function POST(req: Request) {
  const body = await req.json();               // validate input: types, lengths, sizes
  const auth = await apiUser();                 // from @/lib/api-auth: 401 if signed out
  if (!auth.user) return auth.response;
  const t = await getDictionary();              // from @/lib/i18n/server
  const apiKey = getRequestApiKey(req);
  try {
    const result = await myClaudeFn(body.x, { apiKey, locale: t.locale });
    return NextResponse.json({ result });
  } catch (err) {
    return aiErrorResponse(err, t, t.errors.generateFailed); // MissingApiKeyError / AuthenticationError / RateLimitError…
  }
}
```

- Keep analysis separate from saving when the user should confirm first (see `/api/analyze` + `components/AiQuickLog.tsx`).
- Call `revalidatePath()` for pages that show any data you write.
- Never log the API key or the request headers.

## 3. Client

- Send AI requests with `headers: aiHeaders()` from `@/lib/byok-client` (adds `Content-Type` and `x-anthropic-api-key`).
- Show `data.error` from non-OK responses; the server already translates it. All other UI text comes from `useI18n()`: add keys to both `en.ts` and `zh.ts`.
- Shrink images in the browser before upload (`fileToJpegBase64` in `AiQuickLog.tsx`, max edge 1568px).

## 4. Telegram (if the bot should use it too)

The bot calls the same `lib/claude.ts` function with `{ apiKey: ctx.apiKey }` (the key stored with the bot, or the server key) and no locale (Chinese). See the `telegram-command` skill.

## 5. Verify

1. `npx tsc --noEmit && npx eslint app components lib`
2. Use the `run-app` skill: check the route with no key (expect 401 `missing_api_key`), with a fake `sk-ant-` key (expect 401 `invalid_api_key`), and, if the user provides a real key, the success path.
3. Update `docs/ARCHITECTURE.md` if you added a flow or a design decision.

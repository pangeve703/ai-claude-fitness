# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Project overview

AI fitness and nutrition coach: Next.js 16 App Router + Prisma/Postgres + Claude (`@anthropic-ai/sdk`) + a Telegram bot in webhook mode. Multi-user via guest accounts (`lib/session.ts`). The UI is English and Simplified Chinese; code comments and docs are English. See `README.md` and `docs/ARCHITECTURE.md`.

## Conventions

- **All Claude calls live in `lib/claude.ts`** and go through `getClient(opts.apiKey)`. Routes pass `{ apiKey: getRequestApiKey(req) }` and handle errors with `aiErrorResponse()`; clients send `aiHeaders()`. This is what makes bring-your-own-key work, so don't bypass it. Skill: `add-ai-feature`.
- Arithmetic (TDEE, portion splitting) is done in code, never by the model.
- **No hard-coded UI text.** Add every string to `lib/i18n/dictionaries/en.ts` *and* `zh.ts` (the type check enforces it). Client: `const { t } = useI18n()`. Server Components and Route Handlers: `await getDictionary()`. Format numbers and dates with `t.intl`. Values Claude returns that the UI interprets (e.g. intensity) are language-neutral enums.
- AI routes pass `locale: t.locale` to `lib/claude.ts` functions; the Telegram bot omits it (Chinese).
- Telegram bot secrets: `lib/bot-config.ts` (encrypted DB row, then env vars). Never read `TELEGRAM_BOT_TOKEN` directly.
- **Every query is scoped to the signed-in user.** Pages: `const user = await requireUser()`. Route Handlers: `const auth = await apiUser(); if (!auth.user) return auth.response;`. Filter every read by `userId`; update/delete with `where: { id, userId }` (or `findFirst` with both, then act), and return `notFound()` for someone else's records. The Telegram bot uses `ctx.userId`. Add a case to `tests/ownership.test.ts` for new routes.
- **UI design system** (`app/globals.css`): colour tokens `ink / mint / aqua / lilac / peach / lemon / flame / leaf / sky` (as Tailwind classes, e.g. `bg-mint`, `text-flame`), surfaces `.card`, `.card-hero`, `.tint-{aqua,lilac,mint,peach}`, buttons `.btn-ink` (primary) and `.btn-soft`, inputs `.field`. Every surface has a dark variant there, so don't hard-code new colours or `dark:` backgrounds in pages. Shared pieces live in `components/ui/` (WeekStrip, CalorieRing, MacroBars, MealCard, ActionCard) and popups use `components/Sheet.tsx`. Macro colours: carbs = sky, protein = leaf, fat = flame. After UI changes run `npm run screenshots` and look at the result.
- Pages: `page.tsx` (server component, reads Prisma) + `*Client.tsx` (interactivity). Writes go through `app/api/*` route handlers, which call `revalidatePath`.
- Dates for logs are `YYYY-MM-DD` strings in `APP_TIME_ZONE`: always use `dateKey()` / `addDays()` from `lib/dates.ts`, never `toISOString()` or `new Date().getDay()`.
- Calorie and macro targets come only from `lib/nutrition.ts`; weigh-ins go only through `recordWeight()` in `lib/weight-store.ts`.
- Before finishing: `npm run check` (lint, type check, Vitest). Add a test in `tests/` for any pure logic you add or fix.
- Schema changes: skill `db-schema-change`. Bot changes: skill `telegram-command`. Running and verifying: skill `run-app`.

## Safety

- `DATABASE_URL` may point at the production Neon database: confirm before `prisma db push` or `/api/reset`.
- Never commit secrets. `.env*` (except `.env.example`) and `.claude/settings.local.json` are gitignored.
- Never log Anthropic API keys, bot tokens, Telegram API URLs (they contain the token) or request headers.
- Secrets stored in the database must go through `encryptSecret()` in `lib/crypto.ts`.

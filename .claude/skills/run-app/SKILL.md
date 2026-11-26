---
name: run-app
description: Start this Next.js app locally and smoke-test it, including the bring-your-own-key API paths. Use when asked to run, start, build, or verify the app, or to confirm a change works.
---

# Running and verifying the app

## Prerequisites

- `node_modules` installed (`npm install`).
- `.env.local` with `DATABASE_URL` (Postgres). Copy `.env.example`. Without a database, pages fail but `/api/ai/status` and `/api/analyze` still work, which is enough to check AI changes.
- `ANTHROPIC_API_KEY` is optional. Leave it **unset** to test the bring-your-own-key paths.

## Static checks (always)

```bash
npm run check          # lint + tsc + vitest (same as CI)
npm run build          # prisma generate + next build
```

Read the Next 16 docs in `node_modules/next/dist/docs/` before using any Next API you're unsure about (see AGENTS.md).

## Start

```bash
npm run dev            # http://localhost:3000, run in the background
```

Use another port with `-- -p 3123` if 3000 is taken. Stop the server when you're done.

## API smoke tests

```bash
# Is a server key configured?
curl -s localhost:3000/api/ai/status
# Key format check            → 400
curl -s -X POST localhost:3000/api/ai/status -H 'x-anthropic-api-key: nope'
# Fake key (calls Anthropic)  → 401 invalid_api_key
curl -s -X POST localhost:3000/api/ai/status -H 'x-anthropic-api-key: sk-ant-api03-fake'
# No key and no server key    → 401 missing_api_key
curl -s -X POST localhost:3000/api/analyze -H 'content-type: application/json' -d '{"text":"一碗牛肉面"}'
```

Success-path calls cost money. Only run them with a key the user has provided, and say that you did.

With a database: `curl -s localhost:3000/api/profile` and `curl -s "localhost:3000/api/food-log?date=$(date +%F)"`.

## UI check

Pages to visit: `/setup` (first run) → `/dashboard` → `/diet` (AI 快速记录 panel) → `/profile` (API key card). If browser tools are available, check the AI quick-log flow and the key card's verify/save/remove states, in both light and dark mode.

## Don't

- Don't run `prisma db push` or `/api/reset` against a database you haven't confirmed with the user. `DATABASE_URL` may point at production.

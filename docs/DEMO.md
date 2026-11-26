# Demo script

A 5–7 minute walkthrough for presenting the project live. Talking points are in *italics*.

## Before the interview

- [ ] Open the app in a private window, so you start as a fresh guest rather than in your own profile.
- [ ] Have your own API key ready to paste, or set `ANTHROPIC_API_KEY` on the demo instance as a backup.
- [ ] Save 2–3 test images on the device: a mixed plate (rice + meat + sauce), a running-app screenshot, and a dish to show portion splitting.
- [ ] Open the app on a phone or narrow browser window; it's designed mobile-first.
- [ ] Optional, Telegram: set `APP_SECRET` on the deployment and have a BotFather token ready (or connect the bot beforehand).

## Walkthrough

1. **Setup (30 s).** Fill in the 3-step profile. On step 3, paste the API key.
   *"Visitors bring their own Anthropic key. It stays in their browser's localStorage, is checked with a free models.list call, and goes to the server in a header on each AI request. Nothing is stored on the server."*

2. **Generate a plan (60 s).** On 主页 (Home), generate a diet plan, then open 饮食 → AI 饮食计划 (Diet → AI diet plan).
   *"Daily calories come from the Mifflin–St Jeor formula and an activity multiplier worked out in code. Claude turns that into a 7-day meal plan as JSON, and the dashboard's calorie target updates from the plan."*

3. **Photo logging (90 s).** Diet → AI 快速记录 (AI quick log) → upload the mixed plate.
   *"The prompt asks Claude to break the dish into ingredients with gram estimates, a confidence score and a calorie range. Breaking it down catches hidden calories like cooking oil. The photo is shrunk in the browser before upload to keep requests small. Analysing and saving are separate steps, so I review before anything is written."*
   Press 记录 (Log) and show the ✨ entry.

4. **Portion splitting (45 s).** Upload a dish with the caption `两人分` ("split for two").
   *"I don't trust the model with the division. Code parses the 'split by N' instruction, in Chinese or English, Claude returns totals for the whole dish, and the server divides. The answer is exact every time."*

5. **Workout (30 s).** Upload a running screenshot, or type `跑步 5 公里 30 分钟` ("ran 5 km in 30 minutes").
   *"The same endpoint decides whether the input is food or a workout. Calories burned feed into net intake on the dashboard."*

6. **Dashboard (30 s).** Calorie budget, macro ring, 7-day chart, weight trend.

7. **Language (30 s).** Press 中 at the top of Home, then generate or analyse something.
   *"The dictionaries are typed: English defines the shape and Chinese must match, so a missing translation fails the build. Claude gets one 'write in this language' rule, and enums like training intensity stay language-neutral, so stored data doesn't depend on the UI language."*

8. **Telegram (optional, 90 s).** Me → Telegram bot → paste the token → Connect. Send the bot a photo, then `/today`.
   *"This key can't stay in the browser: Telegram calls my webhook directly. So the server checks the token, registers the webhook with a random secret Telegram must echo back, and stores the token and Anthropic key encrypted with AES-256-GCM, with the key in an env var, not the database. The webhook replies 200 straight away and uses `after()` to keep the serverless function alive until Claude answers."*

9. **Code tour (optional).** `lib/claude.ts` (prompts and portion splitting) → `lib/api-key.ts` (key handling and typed errors) → `lib/crypto.ts` + `app/api/telegram/setup` → `lib/i18n/` → `.claude/skills/` (how I use Claude Code on this repo).

## Likely questions

- **Can interviewers see each other's data?** No. Each visitor gets a guest account: a random token in an httpOnly cookie, stored only as a hash. Every query is scoped to that user, and guests are deleted after a week without a visit. Show `tests/ownership.test.ts`.

- **Why Haiku?** Fast and cheap for the visitor paying with their own key, and accurate enough to estimate a meal. The model is one constant to change.
- **How accurate are the calorie estimates?** They're estimates, which is why the app shows a confidence score and a range, and why every entry can be edited.
- **Is the key safe?** On the web it's only in the visitor's browser and sent over HTTPS per request, never logged or stored. The trade-off is that scripts on the page could read localStorage; a production app would use server sessions. For the Telegram bot it has to be stored, so it's encrypted with AES-256-GCM, and disconnecting deletes it.
- **What would you change next?** Multi-user auth, structured outputs instead of regex JSON extraction, prompt caching for the coach chat, and tests around the portion-splitting parser.

## Updating the README screenshots

```bash
npm run build && npx next start -p 3100   # terminal 1 (production build: no dev badge)
npm run screenshots -- http://localhost:3100   # terminal 2
```

This writes `docs/demo/*.png` using a throwaway guest account, which it deletes afterwards. The data is logged by hand, so no API key is needed and no AI output is faked. To add an AI plan or a photo-recognition result, set your key, generate one by hand and take the screenshot yourself.

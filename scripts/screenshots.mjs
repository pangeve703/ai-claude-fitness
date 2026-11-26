// Regenerates the README screenshots in docs/demo/.
//
//   npm run build && npx next start -p 3100     # in one terminal (production build: no dev badge)
//   npm run screenshots -- http://localhost:3100
//
// It signs up a throwaway guest ("Alex"), seeds three weeks of sample data
// through the app's own API, captures each screen at iPhone size in headless
// Chrome, then deletes the guest (DELETE /api/profile). Needs Google Chrome;
// set CHROME_PATH if it isn't in the default macOS location.
//
// The data is sample data logged by hand (no AI output is faked), so no
// Anthropic key is needed.
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const OUT = new URL("../docs/demo/", import.meta.url).pathname;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TZ = process.env.APP_TIME_ZONE ?? "Asia/Singapore";
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// ---- dates in the app's time zone (same rules as lib/dates.ts) ----
const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const daysAgo = (n) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

// ---- tiny API client that keeps the session cookie ----
let cookie = "";
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", "accept-language": "en", ...(cookie && { cookie }) },
    body: body && JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie?.startsWith("fc_session=")) cookie = setCookie.split(";")[0];
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---- sample data ----
const MEALS = {
  breakfast: [["Overnight oats with blueberries", 380, 18, 55, 10], ["Scrambled eggs on toast", 420, 24, 30, 20], ["Kaya toast & soft-boiled eggs", 450, 18, 48, 20]],
  lunch: [["Grilled chicken rice bowl", 640, 42, 70, 18], ["Salmon poke bowl", 590, 35, 62, 20], ["Chicken salad wrap", 520, 34, 45, 18]],
  snack: [["Greek yogurt & almonds", 210, 15, 12, 11], ["Apple & peanut butter", 250, 7, 28, 14]],
  dinner: [["Stir-fried tofu with greens", 520, 28, 40, 24], ["Beef noodle soup", 610, 36, 72, 16], ["Baked salmon & sweet potato", 580, 40, 45, 22]],
};
const pick = (list, i) => list[i % list.length];

async function seed() {
  await api("POST", "/api/profile", {
    name: "Alex", gender: "male", age: 29, height: 178, weight: 78.2,
    activityLevel: "moderate", goal: "lose_fat", targetWeight: 72,
  });

  // 3 weeks of weigh-ins, trending down ~0.1 kg/day with day-to-day noise.
  for (let i = 20; i >= 0; i--) {
    const noise = [0.2, -0.1, 0.3, 0, -0.2, 0.1, 0][i % 7];
    await api("POST", "/api/weight-log", { date: daysAgo(i), weight: Math.round((76 + i * 0.1 + noise) * 10) / 10 });
  }

  // Previous 6 days: full days of meals. Today: breakfast, lunch and a snack so far.
  for (let i = 6; i >= 1; i--) {
    for (const meal of ["breakfast", "lunch", "snack", "dinner"]) {
      if (meal === "snack" && i % 2) continue;
      const [foodName, calories, protein, carbs, fat] = pick(MEALS[meal], i);
      await api("POST", "/api/food-log", { date: daysAgo(i), meal, foodName, calories, protein, carbs, fat });
    }
  }
  for (const meal of ["breakfast", "lunch", "snack"]) {
    const [foodName, calories, protein, carbs, fat] = MEALS[meal][0];
    await api("POST", "/api/food-log", { date: today, meal, foodName, calories, protein, carbs, fat, source: meal === "lunch" ? "web_ai" : "manual" });
  }

  // Workouts (notes use the same shape the AI logging writes).
  const run = (km, min, kcal, pace, hr) => JSON.stringify({ distance: `${km} km`, pace, heartRate: `${hr} bpm`, caloriesBurned: kcal });
  for (const [ago, km, min, kcal, pace, hr] of [[5, 5.0, 31, 330, "6:12/km", 146], [3, 6.1, 37, 400, "6:04/km", 149], [1, 4.2, 26, 280, "6:11/km", 143], [0, 5.2, 32, 340, "6:09/km", 148]]) {
    await api("POST", "/api/training-log", { date: daysAgo(ago), exercise: "Morning run", duration: min, completed: true, notes: run(km, min, kcal, pace, hr) });
  }
  await api("POST", "/api/training-log", { date: today, exercise: "Bodyweight circuit", duration: 20, completed: false });
}

// ---- screenshots ----
async function capture() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const [name, value] = cookie.split("=");
  const host = new URL(BASE).hostname;

  async function shot(file, { path, lang = "en", signedIn = true, dark = false, prepare }) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport(VIEWPORT);
    const cookies = [{ name: "lang", value: lang, domain: host, path: "/" }];
    if (signedIn) cookies.push({ name, value, domain: host, path: "/", httpOnly: true });
    await page.setCookie(...cookies);
    // Pin the colour scheme: the app follows the OS setting when no theme is saved.
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }]);
    await page.goto(BASE + path, { waitUntil: "networkidle0" });
    if (prepare) await prepare(page);
    await new Promise((r) => setTimeout(r, 600)); // let animations settle
    await page.screenshot({ path: `${OUT}${file}.png` });
    await context.close();
    console.log(`  ✓ docs/demo/${file}.png`);
  }

  const scrollTo = (text, offset = 80) => (page) =>
    page.evaluate((t, o) => {
      const el = [...document.querySelectorAll("h1,h2,h3,p,span,div")].find((e) => e.childElementCount === 0 && e.textContent.trim() === t);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o);
    }, text, offset);

  const clickLabel = (label) => (page) => page.evaluate((l) => document.querySelector(`[aria-label="${l}"]`)?.click(), label);

  await shot("setup", { path: "/setup", signedIn: false });
  await shot("dashboard", { path: "/dashboard" });
  await shot("dashboard-meals", { path: "/dashboard", prepare: scrollTo("Meals", 24) });
  await shot("dashboard-charts", { path: "/dashboard", prepare: scrollTo("Last 7 days", 24) });
  await shot("diet", { path: "/diet" });
  await shot("quick-log", { path: "/dashboard", prepare: clickLabel("AI quick log") });
  await shot("add-food", { path: "/diet?add=dinner" });
  await shot("training", { path: "/training" });
  await shot("settings", { path: "/profile" });
  await shot("dashboard-zh", { path: "/dashboard", lang: "zh" });
  await shot("dashboard-dark", { path: "/dashboard", dark: true });

  await browser.close();
}

await mkdir(OUT, { recursive: true });
console.log(`Seeding a demo guest on ${BASE} …`);
try {
  await seed();
  console.log("Capturing:");
  await capture();
} finally {
  if (cookie) {
    await api("DELETE", "/api/profile").catch((e) => console.error("Cleanup failed:", e.message));
    console.log("Demo guest deleted.");
  }
}

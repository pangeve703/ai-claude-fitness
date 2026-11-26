/**
 * One definition of "today" for the whole app (web pages, API routes, Telegram bot).
 *
 * Logs are keyed by calendar date strings ("YYYY-MM-DD") in the user's time zone
 * (APP_TIME_ZONE). Using `new Date().toISOString()` instead gives the UTC date,
 * which in Singapore (UTC+8) files anything logged before 8am under yesterday.
 *
 * Everything except `dateKey` / `hourIn` is pure arithmetic on date keys, so it
 * doesn't depend on the server's own time zone.
 */
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Singapore";

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Calendar date of `date` in `timeZone`, e.g. "2026-11-27". */
export function dateKey(date: Date = new Date(), timeZone: string = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

/** Hour of day (0–23) of `date` in `timeZone`. */
export function hourIn(date: Date = new Date(), timeZone: string = APP_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(part(parts, "hour"));
}

// Date keys are converted to UTC midnight for arithmetic, so DST and the
// server's zone never shift the result.
function toUtc(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Invalid date key: ${key}`);
  return new Date(`${key}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value).getTime());
}

export function addDays(key: string, days: number): string {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 0 = Monday … 6 = Sunday (the order of the weekly plan's days). */
export function weekdayIndex(key: string): number {
  return (toUtc(key).getUTCDay() + 6) % 7;
}

/** The Monday on or before `key`. */
export function weekStart(key: string): string {
  return addDays(key, -weekdayIndex(key));
}

/** Short "M/D" label for charts, e.g. "11/27". */
export function shortLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

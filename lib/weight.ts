/** Pure weight helpers (no database), shared by the API, the UI and the Telegram bot. */
export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 300;

/**
 * Parses user input such as 55.2, "55.2", "55,2", "55.2kg", " 55.2 公斤 "
 * into kilograms rounded to 0.1. Returns null if it isn't a plausible weight.
 */
export function parseWeight(input: unknown): number | null {
  let value: number;
  if (typeof input === "number") {
    value = input;
  } else if (typeof input === "string") {
    const match = input.trim().replace(",", ".").match(/^(\d{1,3}(?:\.\d+)?)\s*(?:kg|kgs|公斤|千克)?$/i);
    if (!match) return null;
    value = Number(match[1]);
  } else {
    return null;
  }
  if (!Number.isFinite(value) || value < MIN_WEIGHT_KG || value > MAX_WEIGHT_KG) return null;
  return Math.round(value * 10) / 10;
}

/** Signed change rounded to 0.1 kg, e.g. -0.4. */
export function weightChange(previous: number, current: number): number {
  return Math.round((current - previous) * 10) / 10;
}

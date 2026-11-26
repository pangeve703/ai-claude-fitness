import { addDays } from "./dates";

/**
 * Consecutive days with at least one food entry, ending today, or ending
 * yesterday if nothing is logged yet today (so the streak doesn't look
 * broken first thing in the morning).
 */
export function loggingStreak(loggedDates: Iterable<string>, today: string): number {
  const days = new Set(loggedDates);
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

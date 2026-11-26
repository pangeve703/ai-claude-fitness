import { describe, expect, it } from "vitest";
import { addDays, dateKey, hourIn, isDateKey, shortLabel, weekdayIndex, weekStart } from "@/lib/dates";

describe("dateKey", () => {
  it("uses the app time zone, not UTC (the bug this module fixes)", () => {
    // 20:00 UTC on the 26th is 04:00 on the 27th in Singapore.
    const instant = new Date("2026-11-26T20:00:00Z");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-11-26"); // the old, wrong answer
    expect(dateKey(instant, "Asia/Singapore")).toBe("2026-11-27");
  });

  it("defaults to APP_TIME_ZONE", () => {
    expect(dateKey(new Date("2026-11-26T20:00:00Z"))).toBe("2026-11-27");
  });

  it("handles zones behind UTC", () => {
    expect(dateKey(new Date("2026-01-01T03:00:00Z"), "America/New_York")).toBe("2025-12-31");
  });
});

describe("hourIn", () => {
  it("returns the hour in the given zone", () => {
    expect(hourIn(new Date("2026-11-26T20:30:00Z"), "Asia/Singapore")).toBe(4);
    expect(hourIn(new Date("2026-11-26T16:00:00Z"), "Asia/Singapore")).toBe(0);
  });
});

describe("addDays", () => {
  it.each([
    ["2026-11-30", 1, "2026-12-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2024-02-28", 1, "2024-02-29"], // leap year
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-11-27", -30, "2026-10-28"],
    ["2026-11-27", 0, "2026-11-27"],
  ])("%s %+d → %s", (key, days, expected) => {
    expect(addDays(key, days)).toBe(expected);
  });

  it("rejects malformed keys", () => {
    expect(() => addDays("27/11/2026", 1)).toThrow();
  });
});

describe("weekdays", () => {
  it("indexes Monday as 0 and Sunday as 6", () => {
    expect(weekdayIndex("2026-11-23")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-26")).toBe(3); // Thursday
    expect(weekdayIndex("2026-11-29")).toBe(6); // Sunday
  });

  it("finds the Monday that starts the week", () => {
    expect(weekStart("2026-11-26")).toBe("2026-11-23");
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(weekStart("2026-11-29")).toBe("2026-11-23");
    expect(weekStart("2026-03-01")).toBe("2026-02-23");
  });
});

describe("formatting and validation", () => {
  it("shortLabel drops leading zeros", () => {
    expect(shortLabel("2026-01-05")).toBe("1/5");
  });

  it("isDateKey accepts only real YYYY-MM-DD dates", () => {
    expect(isDateKey("2026-11-27")).toBe(true);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("2026-1-1")).toBe(false);
    expect(isDateKey(20261127)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { bmiCategory, mealBudgets } from "@/lib/nutrition";
import { loggingStreak } from "@/lib/streak";
import { parseFoodInput, parseFoodPatch, parseWorkoutInput } from "@/lib/validate";

describe("bmiCategory", () => {
  it("uses WHO cut-offs (25 / 30)", () => {
    expect(bmiCategory(24.0, "who")).toBe("normal"); // was mislabelled "Overweight" in English
    expect(bmiCategory(25, "who")).toBe("overweight");
    expect(bmiCategory(30, "who")).toBe("obese");
  });

  it("uses China's cut-offs (24 / 28)", () => {
    expect(bmiCategory(24.0, "china")).toBe("overweight");
    expect(bmiCategory(28, "china")).toBe("obese");
    expect(bmiCategory(18.4, "china")).toBe("underweight");
  });
});

describe("mealBudgets", () => {
  it("splits the daily target 25 / 35 / 30 / 10", () => {
    expect(mealBudgets(2000)).toEqual({ breakfast: 500, lunch: 700, dinner: 600, snack: 200 });
  });
});

describe("loggingStreak", () => {
  const today = "2026-11-27";
  it("counts consecutive days ending today", () => {
    expect(loggingStreak(["2026-11-25", "2026-11-26", "2026-11-27"], today)).toBe(3);
  });
  it("keeps yesterday's streak alive before today's first entry", () => {
    expect(loggingStreak(["2026-11-25", "2026-11-26"], today)).toBe(2);
  });
  it("stops at a gap", () => {
    expect(loggingStreak(["2026-11-23", "2026-11-26", "2026-11-27"], today)).toBe(2);
    expect(loggingStreak(["2026-11-24"], today)).toBe(0);
    expect(loggingStreak([], today)).toBe(0);
  });
});

describe("input validation", () => {
  const food = { meal: "lunch", foodName: "Ramen", calories: 520 };

  it("accepts a valid entry and fills in defaults", () => {
    expect(parseFoodInput(food)).toEqual({
      ok: true,
      data: { date: undefined, meal: "lunch", foodName: "Ramen", calories: 520, protein: 0, carbs: 0, fat: 0, source: "manual" },
    });
  });

  it.each([
    [{ ...food, meal: "brunch" }, "meal"],
    [{ ...food, foodName: "   " }, "foodName"],
    [{ ...food, calories: -5 }, "calories"],
    [{ ...food, calories: "520" }, "calories"],
    [{ ...food, protein: Number.NaN }, "protein"],
    [{ ...food, date: "2099-01-01" }, "date"],
    [null, "meal"],
  ])("rejects %j (%s)", (body, field) => {
    expect(parseFoodInput(body)).toEqual({ ok: false, field });
  });

  it("checks only the fields present in a PATCH", () => {
    expect(parseFoodPatch({ calories: 300 })).toEqual({ ok: true, data: { calories: 300 } });
    expect(parseFoodPatch({ fat: -1 })).toEqual({ ok: false, field: "fat" });
  });

  it("validates workouts", () => {
    expect(parseWorkoutInput({ exercise: "Run", duration: 30, completed: true }).ok).toBe(true);
    expect(parseWorkoutInput({ exercise: "Run", duration: 30.5 })).toEqual({ ok: false, field: "duration" });
    expect(parseWorkoutInput({ exercise: "" })).toEqual({ ok: false, field: "exercise" });
  });
});

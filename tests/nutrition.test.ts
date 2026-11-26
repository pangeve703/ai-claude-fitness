import { describe, expect, it } from "vitest";
import { bmi, bmr, defaultMacros, macroTargets, MIN_DAILY_CALORIES, targetCalories, tdee } from "@/lib/nutrition";

const profile = { gender: "female", weight: 50, height: 170, age: 26, activityLevel: "light", goal: "lose_fat" };

describe("Mifflin–St Jeor", () => {
  it("computes BMR for women and men", () => {
    expect(bmr(profile)).toBeCloseTo(1271.5);
    expect(bmr({ ...profile, gender: "male" })).toBeCloseTo(1437.5);
  });

  it("applies the activity multiplier, defaulting to moderate", () => {
    expect(tdee(profile)).toBeCloseTo(1271.5 * 1.375);
    expect(tdee({ ...profile, activityLevel: "unknown" })).toBeCloseTo(1271.5 * 1.55);
  });
});

describe("targetCalories", () => {
  it("subtracts 500 kcal for fat loss", () => {
    expect(targetCalories(profile)).toBe(Math.round(1271.5 * 1.375 - 500)); // 1248
  });

  it("adds 300 kcal for muscle gain and nothing for other goals", () => {
    expect(targetCalories({ ...profile, goal: "build_muscle" })).toBe(Math.round(1271.5 * 1.375 + 300));
    expect(targetCalories({ ...profile, goal: "run_speed" })).toBe(Math.round(1271.5 * 1.375));
  });

  it("never goes below the safety floor", () => {
    const small = { gender: "female", weight: 40, height: 150, age: 60, activityLevel: "sedentary", goal: "lose_fat" };
    expect(targetCalories(small)).toBe(MIN_DAILY_CALORIES);
  });
});

describe("macros", () => {
  it("splits calories into protein by body weight, 25% fat, rest carbs", () => {
    const m = defaultMacros(2000, 60, "lose_fat");
    expect(m.protein).toBe(108); // 1.8 g/kg
    expect(m.fat).toBe(56); // 2000 × 25% / 9
    expect(m.carbs).toBe(Math.round((2000 - 108 * 4 - 56 * 9) / 4));
  });

  it("uses a plan's macros only when all three are valid", () => {
    expect(macroTargets(2000, 60, "lose_fat", { protein: 120, carbs: 200, fat: 60 })).toEqual({ protein: 120, carbs: 200, fat: 60 });
    expect(macroTargets(2000, 60, "lose_fat", { protein: 120, carbs: 0, fat: 60 })).toEqual(defaultMacros(2000, 60, "lose_fat"));
    expect(macroTargets(2000, 60, "lose_fat", null)).toEqual(defaultMacros(2000, 60, "lose_fat"));
  });

  it("computes BMI", () => {
    expect(bmi(50, 170)).toBeCloseTo(17.3, 1);
  });
});

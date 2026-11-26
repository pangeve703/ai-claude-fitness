import { describe, expect, it } from "vitest";
import { divideFoodResult, getServingDivisor, type ImageAnalysisResult } from "@/lib/claude";

describe("getServingDivisor", () => {
  it.each([
    ["split by 3", 3],
    ["shared between 2 people", 2],
    ["for 4 people", 4],
    ["serves 6", 6],
    ["两人分", 2], // regression: "N人分" wasn't recognised before these tests
    ["两个人分", 2],
    ["2人分", 2],
    ["3个人吃", 3],
    ["分成3份", 3],
    ["4人份", 4],
    ["平均分给三个人", 3],
    ["十二人份", 12],
  ])("%s → %d", (caption, expected) => {
    expect(getServingDivisor(caption)).toBe(expected);
  });

  it.each([[undefined], [""], ["lunch, less oil"], ["split by 1"], ["for 50 people"]])("%j → null", (caption) => {
    expect(getServingDivisor(caption)).toBeNull();
  });
});

describe("divideFoodResult", () => {
  const whole: ImageAnalysisResult = {
    type: "food",
    foodName: "Pizza",
    calories: 1000,
    protein: 40,
    carbs: 120,
    fat: 35,
    description: "Large pizza",
    calorieRange: { min: 900, max: 1200 },
    items: [{ name: "crust", estimatedGrams: 300, calories: 700, protein: 20, carbs: 110, fat: 10, confidence: 0.8 }],
  };

  it("divides totals, range and items, and labels the portion", () => {
    const r = divideFoodResult(whole, 4, "en");
    if (r.type !== "food") throw new Error("expected food");
    expect(r.calories).toBe(250);
    expect(r.fat).toBe(8.8);
    expect(r.calorieRange).toEqual({ min: 225, max: 300 });
    expect(r.items?.[0].estimatedGrams).toBe(75);
    expect(r.foodName).toBe("Pizza (1/4 portion)");
  });

  it("labels portions in Chinese by default", () => {
    const r = divideFoodResult(whole, 2);
    expect(r.type === "food" && r.foodName).toBe("Pizza（1/2份）");
  });

  it("leaves results alone without a divisor or for workouts", () => {
    expect(divideFoodResult(whole, null)).toBe(whole);
    const workout: ImageAnalysisResult = { type: "workout", activity: "Run", duration: 30, details: "", suggestions: "" };
    expect(divideFoodResult(workout, 3)).toBe(workout);
  });
});

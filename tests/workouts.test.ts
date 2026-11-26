import { describe, expect, it } from "vitest";
import { caloriesBurned, parseWorkoutNotes } from "@/lib/workouts";

const run = (kcal: number, completed = true) => ({ completed, notes: JSON.stringify({ distance: "5 km", caloriesBurned: kcal }) });

describe("caloriesBurned", () => {
  it("sums recorded calories of completed workouts", () => {
    expect(caloriesBurned([run(340), run(120)])).toBe(460);
  });

  it("ignores unfinished workouts and workouts without recorded calories (no guessing)", () => {
    expect(caloriesBurned([run(340), run(200, false), { completed: true, notes: null }, { completed: true, notes: "felt good" }])).toBe(340);
  });

  it("ignores junk values", () => {
    expect(caloriesBurned([{ completed: true, notes: '{"caloriesBurned":"abc"}' }, { completed: true, notes: '{"caloriesBurned":-50}' }])).toBe(0);
  });
});

describe("parseWorkoutNotes", () => {
  it("parses JSON objects and rejects everything else", () => {
    expect(parseWorkoutNotes('{"pace":"6:00/km"}')).toEqual({ pace: "6:00/km" });
    expect(parseWorkoutNotes("plain text")).toBeNull();
    expect(parseWorkoutNotes("[1,2]")).toBeNull();
    expect(parseWorkoutNotes(null)).toBeNull();
  });
});

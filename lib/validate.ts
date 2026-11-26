import { dateKey, isDateKey } from "./dates";

/**
 * Input checks for the log routes. Each returns either clean data or the name
 * of the first invalid field, which the route turns into a 400.
 */
export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Result<T> = { ok: true; data: T } | { ok: false; field: string };

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const validDate = (v: unknown) => v === undefined || (isDateKey(v) && v <= dateKey());

export interface FoodInput {
  date?: string;
  meal: (typeof MEALS)[number];
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "manual" | "web_ai";
}

/** Full entry (POST). Macros default to 0. */
export function parseFoodInput(body: unknown): Result<FoodInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!validDate(b.date)) return { ok: false, field: "date" };
  if (!MEALS.includes(b.meal as never)) return { ok: false, field: "meal" };
  if (!isText(b.foodName, 120)) return { ok: false, field: "foodName" };
  if (!isNum(b.calories, 0, 10000)) return { ok: false, field: "calories" };
  for (const k of ["protein", "carbs", "fat"] as const) {
    if (b[k] !== undefined && !isNum(b[k], 0, 1000)) return { ok: false, field: k };
  }
  return {
    ok: true,
    data: {
      date: b.date as string | undefined,
      meal: b.meal as FoodInput["meal"],
      foodName: (b.foodName as string).trim(),
      calories: b.calories as number,
      protein: (b.protein as number) ?? 0,
      carbs: (b.carbs as number) ?? 0,
      fat: (b.fat as number) ?? 0,
      source: b.source === "web_ai" ? "web_ai" : "manual",
    },
  };
}

/** Partial update (PATCH): only the fields present are checked and returned. */
export function parseFoodPatch(body: unknown): Result<Partial<Omit<FoodInput, "date" | "source">>> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: Partial<Omit<FoodInput, "date" | "source">> = {};
  if (b.meal !== undefined) {
    if (!MEALS.includes(b.meal as never)) return { ok: false, field: "meal" };
    data.meal = b.meal as FoodInput["meal"];
  }
  if (b.foodName !== undefined) {
    if (!isText(b.foodName, 120)) return { ok: false, field: "foodName" };
    data.foodName = (b.foodName as string).trim();
  }
  if (b.calories !== undefined) {
    if (!isNum(b.calories, 0, 10000)) return { ok: false, field: "calories" };
    data.calories = b.calories as number;
  }
  for (const k of ["protein", "carbs", "fat"] as const) {
    if (b[k] !== undefined) {
      if (!isNum(b[k], 0, 1000)) return { ok: false, field: k };
      data[k] = b[k] as number;
    }
  }
  return { ok: true, data };
}

export interface WorkoutInput {
  date?: string;
  exercise: string;
  duration: number;
  completed: boolean;
  notes?: string;
}

export function parseWorkoutInput(body: unknown): Result<WorkoutInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!validDate(b.date)) return { ok: false, field: "date" };
  if (!isText(b.exercise, 120)) return { ok: false, field: "exercise" };
  const duration = b.duration ?? 0;
  if (!isNum(duration, 0, 1440) || !Number.isInteger(duration)) return { ok: false, field: "duration" };
  if (b.notes !== undefined && b.notes !== null && (typeof b.notes !== "string" || b.notes.length > 4000)) {
    return { ok: false, field: "notes" };
  }
  return {
    ok: true,
    data: {
      date: b.date as string | undefined,
      exercise: (b.exercise as string).trim(),
      duration,
      completed: b.completed === true,
      notes: (b.notes as string | undefined) ?? undefined,
    },
  };
}

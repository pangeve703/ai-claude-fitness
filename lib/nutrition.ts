/**
 * Single source of truth for calorie and macro targets. Used by the dashboard
 * and by the diet-plan prompt, so the number Claude plans around is the same
 * number the dashboard shows. (Previously each computed its own, and only the
 * dashboard applied the goal adjustment.)
 *
 * Mifflin–St Jeor BMR × activity multiplier = TDEE, then a goal adjustment.
 */
export interface BodyProfile {
  gender: string;
  weight: number; // kg
  height: number; // cm
  age: number;
  activityLevel: string;
  goal: string;
}

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const DEFAULT_MULTIPLIER = ACTIVITY_MULTIPLIERS.moderate;

/** Daily calorie adjustment per goal: a moderate deficit for fat loss, a small surplus for muscle. */
export const GOAL_CALORIE_ADJUSTMENT: Record<string, number> = {
  lose_fat: -500,
  build_muscle: 300,
};

/** Never recommend eating below this, whatever the maths says. */
export const MIN_DAILY_CALORIES = 1200;

export function bmr(p: Pick<BodyProfile, "gender" | "weight" | "height" | "age">): number {
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  return p.gender === "male" ? base + 5 : base - 161;
}

export function tdee(p: BodyProfile): number {
  return bmr(p) * (ACTIVITY_MULTIPLIERS[p.activityLevel] ?? DEFAULT_MULTIPLIER);
}

export function targetCalories(p: BodyProfile): number {
  const target = tdee(p) + (GOAL_CALORIE_ADJUSTMENT[p.goal] ?? 0);
  return Math.max(MIN_DAILY_CALORIES, Math.round(target));
}

export function bmi(weightKg: number, heightCm: number): number {
  return weightKg / (heightCm / 100) ** 2;
}

/**
 * BMI cut-offs differ by standard: WHO uses 25 / 30 for overweight / obese;
 * China's WS/T 428 uses 24 / 28 (calibrated for East Asian populations).
 * Each language uses the standard its readers expect (see `bmiStandard` in
 * the dictionaries). Previously English showed China's cut-offs, labelling
 * a BMI of 24.0 "Overweight".
 */
export type BmiStandard = "who" | "china";
export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

const BMI_CUTOFFS: Record<BmiStandard, [number, number, number]> = {
  who: [18.5, 25, 30],
  china: [18.5, 24, 28],
};

export function bmiCategory(value: number, standard: BmiStandard): BmiCategory {
  const [under, over, obese] = BMI_CUTOFFS[standard];
  if (value < under) return "underweight";
  if (value < over) return "normal";
  if (value < obese) return "overweight";
  return "obese";
}

/** Share of the daily target for each meal; used for the per-meal progress bars. */
export const MEAL_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 } as const;
export type MealKey = keyof typeof MEAL_SHARE;
export const MEAL_ORDER: MealKey[] = ["breakfast", "lunch", "snack", "dinner"];

export function mealBudgets(dailyCalories: number): Record<MealKey, number> {
  return {
    breakfast: Math.round(dailyCalories * MEAL_SHARE.breakfast),
    lunch: Math.round(dailyCalories * MEAL_SHARE.lunch),
    dinner: Math.round(dailyCalories * MEAL_SHARE.dinner),
    snack: Math.round(dailyCalories * MEAL_SHARE.snack),
  };
}

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Default macro split: protein by body weight (more when cutting or building),
 * 25% of calories from fat, the rest from carbs.
 */
export function defaultMacros(calories: number, weightKg: number, goal: string): Macros {
  const proteinPerKg = goal === "build_muscle" ? 2 : goal === "lose_fat" ? 1.8 : 1.5;
  const protein = Math.round(weightKg * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}

/** Uses a plan's macros when all three are positive numbers, otherwise the default split. */
export function macroTargets(
  calories: number,
  weightKg: number,
  goal: string,
  planned?: Partial<Macros> | null
): Macros {
  if (planned && [planned.protein, planned.carbs, planned.fat].every((v) => typeof v === "number" && v > 0)) {
    return {
      protein: Math.round(planned.protein!),
      carbs: Math.round(planned.carbs!),
      fat: Math.round(planned.fat!),
    };
  }
  return defaultMacros(calories, weightKg, goal);
}

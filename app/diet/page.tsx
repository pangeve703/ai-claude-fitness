import { prisma } from "@/lib/prisma";
import { addDays, dateKey, isDateKey, weekStart, weekdayIndex } from "@/lib/dates";
import { macroTargets, mealBudgets, MEAL_ORDER, targetCalories, type MealKey } from "@/lib/nutrition";
import { requireUser } from "@/lib/session";
import NavBar from "@/components/NavBar";
import DietClient from "./DietClient";

export const dynamic = "force-dynamic";

/**
 * ?date=YYYY-MM-DD views and logs a past day; ?add=<meal> opens the add sheet
 * for that meal (links from the dashboard's meal cards); ?tab=plan shows the AI plan.
 */
export default async function DietPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; add?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const today = dateKey();
  const selected = isDateKey(params.date) && params.date <= today ? params.date : today;
  const monday = weekStart(selected);

  const [foodLogs, weekFood, plan] = await Promise.all([
    prisma.foodLog.findMany({ where: { userId: user.id, date: selected }, orderBy: { createdAt: "asc" } }),
    prisma.foodLog.findMany({
      where: { userId: user.id, date: { gte: monday, lte: addDays(monday, 6) } },
      select: { date: true, calories: true },
    }),
    prisma.plan.findFirst({ where: { userId: user.id, type: "diet" }, orderBy: { createdAt: "desc" } }),
  ]);

  const totals = foodLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fat: acc.fat + log.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Same rule as the dashboard: the plan's numbers if there is a plan, else lib/nutrition.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plan JSON from Claude, shape checked in the client
  let planContent: any = null;
  try {
    planContent = plan ? JSON.parse(plan.content) : null;
  } catch {}
  const target = planContent?.dailyCalories > 0 ? Math.round(planContent.dailyCalories) : targetCalories(user);
  const macros = macroTargets(target, user.weight, user.goal, planContent?.macros);

  const weekProgress = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => [
      d,
      weekFood.filter((l) => l.date === d).reduce((s, l) => s + l.calories, 0) / target,
    ])
  );
  const addMeal = MEAL_ORDER.includes(params.add as MealKey) ? (params.add as MealKey) : null;

  return (
    <div className="min-h-screen pb-28">
      <DietClient
        foodLogs={foodLogs}
        totals={totals}
        plan={planContent}
        targetCalories={target}
        macroTargets={macros}
        mealBudgets={mealBudgets(target)}
        today={today}
        selected={selected}
        todayIndex={weekdayIndex(today)}
        weekProgress={weekProgress}
        initialAdd={addMeal}
        initialTab={params.tab === "plan" ? "plan" : "log"}
      />
      <NavBar today={today} />
    </div>
  );
}

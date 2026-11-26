import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import NavBar from "@/components/NavBar";
import DashboardClient from "./DashboardClient";
import { getBotStatus } from "@/lib/bot-config";
import { addDays, dateKey, isDateKey, shortLabel, weekStart } from "@/lib/dates";
import { bmi as calcBmi, macroTargets as calcMacroTargets, mealBudgets, targetCalories as calcTargetCalories } from "@/lib/nutrition";
import { latestWeighIn } from "@/lib/weight-store";
import { caloriesBurned } from "@/lib/workouts";
import { loggingStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

interface DietPlanContent {
  dailyCalories?: number;
  macros?: { protein?: number; carbs?: number; fat?: number };
}

function parsePlan(content: string | null | undefined): DietPlanContent | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const userId = user.id;

  // All dates are calendar days in APP_TIME_ZONE (lib/dates.ts). `?date=` browses past days.
  const today = dateKey();
  const requested = (await searchParams).date;
  const selected = isDateKey(requested) && requested <= today ? requested : today;
  const monday = weekStart(selected);
  const rangeStart = [addDays(selected, -6), monday].sort()[0];
  const rangeEnd = addDays(monday, 6);

  const [foodLogs, trainingLogs, rangeFood, rangeWorkouts, latestDietPlan, latestTrainingPlan, loggedDays] = await Promise.all([
    prisma.foodLog.findMany({
      where: { userId, date: selected },
      select: { id: true, foodName: true, meal: true, calories: true, protein: true, carbs: true, fat: true, source: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.trainingLog.findMany({ where: { userId, date: selected } }),
    prisma.foodLog.findMany({ where: { userId, date: { gte: rangeStart, lte: rangeEnd } }, select: { date: true, calories: true } }),
    prisma.trainingLog.findMany({
      where: { userId, date: { gte: rangeStart, lte: rangeEnd } },
      select: { date: true, notes: true, completed: true },
    }),
    prisma.plan.findFirst({ where: { userId, type: "diet" }, orderBy: { createdAt: "desc" } }),
    prisma.plan.findFirst({ where: { userId, type: "training" }, orderBy: { createdAt: "desc" } }),
    prisma.foodLog.findMany({
      where: { userId, date: { gte: addDays(today, -120) } },
      select: { date: true },
      distinct: ["date"],
    }),
  ]);

  // One plan of each type per week (Monday–Sunday).
  const thisWeek = weekStart(today);
  const nextWeekLabel = shortLabel(addDays(thisWeek, 7));
  const lockedUntil = (plan: { createdAt: Date } | null) => (plan && dateKey(plan.createdAt) >= thisWeek ? nextWeekLabel : null);

  // A diet plan's daily calories win (computed by lib/nutrition.ts when the plan was made).
  const plan = parsePlan(latestDietPlan?.content);
  const targetCalories = plan?.dailyCalories && plan.dailyCalories > 0 ? Math.round(plan.dailyCalories) : calcTargetCalories(user);
  const macroTargets = calcMacroTargets(targetCalories, user.weight, user.goal, plan?.macros);

  const eatenOn = (date: string) => Math.round(rangeFood.filter((l) => l.date === date).reduce((s, l) => s + l.calories, 0));
  const weekProgress = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => [d, eatenOn(d) / targetCalories])
  );
  const chartData = Array.from({ length: 7 }, (_, i) => addDays(selected, i - 6)).map((date) => ({
    date: shortLabel(date),
    consumed: eatenOn(date),
    burned: caloriesBurned(rangeWorkouts.filter((w) => w.date === date)),
  }));

  const weightLogs = await prisma.weightLog.findMany({
    where: { userId, date: { gte: addDays(today, -30) } },
    orderBy: { date: "asc" },
    select: { date: true, weight: true },
  });

  const eaten = foodLogs.reduce(
    (acc, l) => ({ calories: acc.calories + l.calories, protein: acc.protein + l.protein, carbs: acc.carbs + l.carbs, fat: acc.fat + l.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const [botStatus, lastWeighIn] = await Promise.all([getBotStatus(userId), latestWeighIn(userId)]);

  return (
    <div className="min-h-screen pb-28">
      <DashboardClient
        user={{ name: user.name, weight: user.weight, goal: user.goal, targetWeight: user.targetWeight ?? null }}
        today={today}
        selected={selected}
        bmi={calcBmi(user.weight, user.height)}
        streak={loggingStreak(loggedDays.map((d) => d.date), today)}
        eaten={eaten}
        burned={caloriesBurned(trainingLogs)}
        workouts={{ done: trainingLogs.filter((l) => l.completed).length, total: trainingLogs.length }}
        foodLogs={foodLogs}
        targetCalories={targetCalories}
        macroTargets={macroTargets}
        mealBudgets={mealBudgets(targetCalories)}
        weekProgress={weekProgress}
        chartData={chartData}
        weightChartData={weightLogs.map((l) => ({ date: shortLabel(l.date), weight: l.weight }))}
        lastWeighIn={lastWeighIn}
        plans={{
          diet: { exists: !!latestDietPlan, lockedUntil: lockedUntil(latestDietPlan) },
          training: { exists: !!latestTrainingPlan, lockedUntil: lockedUntil(latestTrainingPlan) },
        }}
        telegramBot={{ connected: botStatus.connected, username: botStatus.username }}
      />
      <NavBar today={today} />
    </div>
  );
}

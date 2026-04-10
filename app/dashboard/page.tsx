export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import DashboardClient from "./DashboardClient";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ...
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextMonday(date: Date): string {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 7);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function DashboardPage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/setup");

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekStart = getWeekStart(now);

  const foodLogs = await prisma.foodLog.findMany({
    where: { date: today },
    select: { foodName: true, meal: true, calories: true, protein: true, carbs: true, fat: true },
    orderBy: { createdAt: "asc" },
  });
  const trainingLogs = await prisma.trainingLog.findMany({ where: { date: today } });

  const latestDietPlan = await prisma.plan.findFirst({
    where: { type: "diet" },
    orderBy: { createdAt: "desc" },
  });
  const latestTrainingPlan = await prisma.plan.findFirst({
    where: { type: "training" },
    orderBy: { createdAt: "desc" },
  });

  // Week lock: disable plan generation if already generated this week
  const dietLockedUntil = latestDietPlan && new Date(latestDietPlan.createdAt) >= weekStart
    ? nextMonday(now)
    : null;
  const trainingLockedUntil = latestTrainingPlan && new Date(latestTrainingPlan.createdAt) >= weekStart
    ? nextMonday(now)
    : null;

  const todayCalories = foodLogs.reduce((sum: number, log) => sum + log.calories, 0);
  const completedWorkouts = trainingLogs.filter((l) => l.completed).length;

  const bmi = user.weight / ((user.height / 100) ** 2);

  const bmr =
    user.gender === "male"
      ? 10 * user.weight + 6.25 * user.height - 5 * user.age + 5
      : 10 * user.weight + 6.25 * user.height - 5 * user.age - 161;
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  let targetCalories = Math.round(bmr * (activityMultipliers[user.activityLevel] || 1.55));
  if (user.goal === "lose_fat") targetCalories -= 500;
  else if (user.goal === "build_muscle") targetCalories += 300;

  // Last 7 days calorie chart data
  const chartDays: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    chartDays.push(d.toISOString().split("T")[0]);
  }
  const weekLogs = await prisma.foodLog.findMany({
    where: { date: { gte: chartDays[0] } },
    select: { date: true, calories: true },
  });
  const weekWorkouts = await prisma.trainingLog.findMany({
    where: { date: { gte: chartDays[0] } },
    select: { date: true, notes: true },
  });

  const chartData = chartDays.map((date) => {
    const dayLogs = weekLogs.filter((l) => l.date === date);
    const consumed = Math.round(dayLogs.reduce((sum: number, l) => sum + l.calories, 0));
    // Parse burned calories from workout notes JSON
    const dayWorkouts = weekWorkouts.filter((w) => w.date === date);
    let burned = 0;
    for (const w of dayWorkouts) {
      try {
        const n = JSON.parse(w.notes || "{}");
        burned += n.caloriesBurned || 0;
      } catch {}
    }
    const label = `${parseInt(date.split("-")[1])}/${parseInt(date.split("-")[2])}`;
    return { date: label, consumed, burned: Math.round(burned), target: targetCalories };
  });

  return (
    <div className="pb-20 min-h-screen bg-slate-50">
      <DashboardClient
        user={user}
        todayCalories={todayCalories}
        targetCalories={targetCalories}
        completedWorkouts={completedWorkouts}
        totalWorkouts={trainingLogs.length}
        foodLogs={foodLogs}
        bmi={bmi}
        hasDietPlan={!!latestDietPlan}
        hasTrainingPlan={!!latestTrainingPlan}
        dietLockedUntil={dietLockedUntil}
        trainingLockedUntil={trainingLockedUntil}
        chartData={chartData}
      />
      <NavBar />
    </div>
  );
}

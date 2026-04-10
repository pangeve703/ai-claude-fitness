export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import DietClient from "./DietClient";

export default async function DietPage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/setup");

  const today = new Date().toISOString().split("T")[0];
  const foodLogs = await prisma.foodLog.findMany({
    where: { date: today },
    orderBy: { createdAt: "asc" },
  });

  const plan = await prisma.plan.findFirst({
    where: { type: "diet" },
    orderBy: { createdAt: "desc" },
  });

  const totals = foodLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fat: acc.fat + log.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="pb-20 min-h-screen bg-slate-50">
      <DietClient
        foodLogs={foodLogs}
        totals={totals}
        plan={plan ? JSON.parse(plan.content) : null}
        today={today}
      />
      <NavBar />
    </div>
  );
}

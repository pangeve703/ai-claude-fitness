import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import TrainingClient from "./TrainingClient";

export default async function TrainingPage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/setup");

  const today = new Date().toISOString().split("T")[0];
  const trainingLogs = await prisma.trainingLog.findMany({
    where: { date: today },
    orderBy: { createdAt: "asc" },
  });

  const plan = await prisma.plan.findFirst({
    where: { type: "training" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="pb-20 min-h-screen bg-slate-50">
      <TrainingClient
        trainingLogs={trainingLogs}
        plan={plan ? JSON.parse(plan.content) : null}
        today={today}
        goal={user.goal}
      />
      <NavBar />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { dateKey, weekdayIndex } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import NavBar from "@/components/NavBar";
import TrainingClient from "./TrainingClient";

export const dynamic = "force-dynamic";

export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const today = dateKey();

  const [trainingLogs, plan] = await Promise.all([
    prisma.trainingLog.findMany({ where: { userId: user.id, date: today }, orderBy: { createdAt: "asc" } }),
    prisma.plan.findFirst({ where: { userId: user.id, type: "training" }, orderBy: { createdAt: "desc" } }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plan JSON from Claude, shape checked in the client
  let planContent: any = null;
  try {
    planContent = plan ? JSON.parse(plan.content) : null;
  } catch {}

  return (
    <div className="min-h-screen pb-28">
      <TrainingClient
        trainingLogs={trainingLogs}
        plan={planContent}
        today={today}
        todayIndex={weekdayIndex(today)}
        initialTab={(await searchParams).tab === "plan" ? "plan" : "today"}
      />
      <NavBar today={today} />
    </div>
  );
}

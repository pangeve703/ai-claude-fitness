import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/api-auth";

/** Clears the current user's food logs, workouts and plans. The profile and weigh-ins are kept. */
export async function DELETE() {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  try {
    const userId = auth.user.id;
    await prisma.$transaction([
      prisma.foodLog.deleteMany({ where: { userId } }),
      prisma.trainingLog.deleteMany({ where: { userId } }),
      prisma.plan.deleteMany({ where: { userId } }),
    ]);
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "重置失败" }, { status: 500 });
  }
}

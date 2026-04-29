import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const logs = await prisma.foodLog.findMany({
    where: { date },
    orderBy: { createdAt: "asc" },
  });

  const totals = logs.reduce(
    (
      acc: { calories: number; protein: number; carbs: number; fat: number },
      log: { calories: number; protein: number; carbs: number; fat: number }
    ) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fat: acc.fat + log.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  revalidatePath("/dashboard");
  revalidatePath("/diet");
  return NextResponse.json({ logs, totals });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const log = await prisma.foodLog.create({
      data: {
        userId: 1,
        date: body.date || new Date().toISOString().split("T")[0],
        meal: body.meal,
        foodName: body.foodName,
        calories: body.calories,
        protein: body.protein || 0,
        carbs: body.carbs || 0,
        fat: body.fat || 0,
        source: "manual",
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/diet");
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ error: "记录失败" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    const log = await prisma.foodLog.update({
      where: { id: body.id },
      data: {
        ...(body.meal !== undefined && { meal: body.meal }),
        ...(body.foodName !== undefined && { foodName: body.foodName }),
        ...(body.calories !== undefined && { calories: body.calories }),
        ...(body.protein !== undefined && { protein: body.protein }),
        ...(body.carbs !== undefined && { carbs: body.carbs }),
        ...(body.fat !== undefined && { fat: body.fat }),
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/diet");
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0");

  await prisma.foodLog.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/diet");
  return NextResponse.json({ success: true });
}

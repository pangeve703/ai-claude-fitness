import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const logs = await prisma.foodLog.findMany({
    where: { date },
    orderBy: { createdAt: "asc" },
  });

  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fat: acc.fat + log.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

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
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ error: "记录失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0");

  await prisma.foodLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

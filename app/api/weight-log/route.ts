import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  const logs = await prisma.weightLog.findMany({
    where: { date: { gte: sinceStr } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const date = body.date || new Date().toISOString().split("T")[0];
    if (!body.weight) return NextResponse.json({ error: "缺少体重" }, { status: 400 });

    const sameDay = await prisma.weightLog.findFirst({ where: { userId: 1, date } });
    const log = sameDay
      ? await prisma.weightLog.update({ where: { id: sameDay.id }, data: { weight: body.weight } })
      : await prisma.weightLog.create({ data: { userId: 1, date, weight: body.weight } });

    revalidatePath("/dashboard");
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ error: "记录失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0");
  await prisma.weightLog.delete({ where: { id } });
  revalidatePath("/dashboard");
  return NextResponse.json({ success: true });
}

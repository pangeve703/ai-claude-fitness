import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateKey } from "@/lib/dates";
import { apiUser, notFound } from "@/lib/api-auth";
import { parseFoodInput, parseFoodPatch } from "@/lib/validate";
import { getDictionary } from "@/lib/i18n/server";

async function invalid(field: string) {
  const t = await getDictionary();
  return NextResponse.json({ error: t.errors.invalidField(field), field }, { status: 400 });
}

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/diet");
}

export async function GET(req: NextRequest) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const date = new URL(req.url).searchParams.get("date") || dateKey();

  const logs = await prisma.foodLog.findMany({
    where: { userId: auth.user.id, date },
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
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const input = parseFoodInput(await req.json().catch(() => null));
  if (!input.ok) return invalid(input.field);
  try {
    const { date, ...fields } = input.data;
    const log = await prisma.foodLog.create({
      data: { userId: auth.user.id, date: date ?? dateKey(), ...fields },
    });
    revalidate();
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ error: "记录失败" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(body?.id)) return invalid("id");
  const patch = parseFoodPatch(body);
  if (!patch.ok) return invalid(patch.field);
  try {
    // Only the owner's own entries can be changed.
    const existing = await prisma.foodLog.findFirst({ where: { id: body.id, userId: auth.user.id } });
    if (!existing) return notFound();
    const log = await prisma.foodLog.update({ where: { id: existing.id }, data: patch.data });
    revalidate();
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
  const { count } = await prisma.foodLog.deleteMany({ where: { id, userId: auth.user.id } });
  if (count === 0) return notFound();
  revalidate();
  return NextResponse.json({ success: true });
}

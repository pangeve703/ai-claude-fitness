import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateKey } from "@/lib/dates";
import { apiUser, notFound } from "@/lib/api-auth";
import { parseWorkoutInput } from "@/lib/validate";
import { getDictionary } from "@/lib/i18n/server";

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/training");
}

export async function GET(req: Request) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const date = new URL(req.url).searchParams.get("date") || dateKey();
  const logs = await prisma.trainingLog.findMany({
    where: { userId: auth.user.id, date },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const input = parseWorkoutInput(await req.json().catch(() => null));
  if (!input.ok) {
    const t = await getDictionary();
    return NextResponse.json({ error: t.errors.invalidField(input.field), field: input.field }, { status: 400 });
  }
  const { date, ...fields } = input.data;
  const log = await prisma.trainingLog.create({
    data: { userId: auth.user.id, date: date ?? dateKey(), ...fields },
  });
  revalidate();
  return NextResponse.json({ log });
}

export async function PATCH(req: Request) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(body?.id)) return notFound();
  const { count } = await prisma.trainingLog.updateMany({
    where: { id: body.id, userId: auth.user.id },
    data: { completed: Boolean(body.completed) },
  });
  if (count === 0) return notFound();
  revalidate();
  return NextResponse.json({ success: true });
}

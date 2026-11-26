import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, dateKey, isDateKey } from "@/lib/dates";
import { parseWeight } from "@/lib/weight";
import { recordWeight } from "@/lib/weight-store";
import { getDictionary } from "@/lib/i18n/server";
import { apiUser, notFound } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30") || 30, 1), 365);
  const logs = await prisma.weightLog.findMany({
    where: { userId: auth.user.id, date: { gte: addDays(dateKey(), -days) } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ logs });
}

/**
 * Record a weigh-in. Body: { weight: number | "55.2kg", date?: "YYYY-MM-DD" }.
 * Defaults to today in APP_TIME_ZONE; the latest entry also updates the profile weight.
 */
export async function POST(req: NextRequest) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const t = await getDictionary();
  const body = (await req.json().catch(() => null)) as { weight?: unknown; date?: unknown } | null;

  const weight = parseWeight(body?.weight);
  if (weight === null) return NextResponse.json({ error: t.errors.invalidWeight }, { status: 400 });

  const date = body?.date === undefined ? dateKey() : body.date;
  if (!isDateKey(date) || date > dateKey()) {
    return NextResponse.json({ error: t.errors.invalidDate }, { status: 400 });
  }

  try {
    const result = await recordWeight(auth.user.id, weight, date);
    revalidatePath("/dashboard");
    revalidatePath("/profile");
    return NextResponse.json(result);
  } catch (err) {
    console.error("Weight log error:", err);
    return NextResponse.json({ error: t.errors.saveFailed }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
  const { count } = await prisma.weightLog.deleteMany({ where: { id, userId: auth.user.id } });
  if (count === 0) return notFound();
  revalidatePath("/dashboard");
  return NextResponse.json({ success: true });
}

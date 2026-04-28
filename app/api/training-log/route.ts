import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const logs = await prisma.trainingLog.findMany({
    where: { date },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const body = await req.json();
  const log = await prisma.trainingLog.create({
    data: {
      userId: 1,
      date: body.date || new Date().toISOString().split("T")[0],
      exercise: body.exercise,
      duration: body.duration || 0,
      completed: body.completed || false,
      notes: body.notes,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/training");
  return NextResponse.json({ log });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const log = await prisma.trainingLog.update({
    where: { id: body.id },
    data: { completed: body.completed },
  });
  revalidatePath("/dashboard");
  revalidatePath("/training");
  return NextResponse.json({ log });
}

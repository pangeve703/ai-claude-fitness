import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  try {
    await prisma.foodLog.deleteMany({});
    await prisma.trainingLog.deleteMany({});
    await prisma.plan.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "重置失败" }, { status: 500 });
  }
}

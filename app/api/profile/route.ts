import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await prisma.user.findFirst();
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: "获取用户失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const existing = await prisma.user.findFirst();

    // Partial update: only apply fields present in the request body
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name || "用户";
    if (body.height !== undefined) data.height = body.height;
    if (body.weight !== undefined) data.weight = body.weight;
    if (body.age !== undefined) data.age = body.age;
    if (body.gender !== undefined) data.gender = body.gender;
    if (body.activityLevel !== undefined) data.activityLevel = body.activityLevel;
    if (body.goal !== undefined) data.goal = body.goal;
    if ("targetWeight" in body) data.targetWeight = body.targetWeight;

    let user;
    if (existing) {
      user = await prisma.user.update({ where: { id: existing.id }, data });
    } else {
      user = await prisma.user.create({
        data: {
          id: 1,
          name: (body.name as string) || "用户",
          height: body.height,
          weight: body.weight,
          age: body.age,
          gender: body.gender,
          activityLevel: body.activityLevel,
          goal: body.goal,
          targetWeight: body.targetWeight ?? null,
        },
      });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "保存用户失败" }, { status: 500 });
  }
}

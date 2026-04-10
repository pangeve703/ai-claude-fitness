import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDietPlan, generateTrainingPlan } from "@/lib/claude";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "diet";

    const plan = await prisma.plan.findFirst({
      where: { type },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ error: "获取计划失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type } = await req.json();
    const user = await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: "请先完成个人资料设置" }, { status: 400 });
    }

    const profile = {
      name: user.name,
      height: user.height,
      weight: user.weight,
      age: user.age,
      gender: user.gender,
      activityLevel: user.activityLevel,
      goal: user.goal,
      targetWeight: user.targetWeight,
    };

    let content: string;
    if (type === "diet") {
      content = await generateDietPlan(profile);
    } else {
      content = await generateTrainingPlan(profile);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonContent = jsonMatch ? jsonMatch[0] : content;

    const plan = await prisma.plan.create({
      data: {
        userId: 1,
        type,
        content: jsonContent,
      },
    });

    return NextResponse.json({ plan });
  } catch (err) {
    const error = err as { status?: number; message?: string };
    console.error("Plan error:", error?.status, error?.message);
    const msg =
      error?.status === 401
        ? "API Key 无效，请在 .env.local 填入有效的 Anthropic API Key（sk-ant-...）"
        : error?.status === 429
        ? "请求过于频繁，请稍后重试"
        : "生成失败：" + (error?.message || "未知错误");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

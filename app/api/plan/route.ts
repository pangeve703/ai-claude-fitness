import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDietPlan, generateTrainingPlan } from "@/lib/claude";
import { aiErrorResponse, getRequestApiKey } from "@/lib/api-key";
import { getDictionary } from "@/lib/i18n/server";
import { apiUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "diet";

    const plan = await prisma.plan.findFirst({
      where: { userId: auth.user.id, type },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ error: "获取计划失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const t = await getDictionary();
  const auth = await apiUser();
  if (!auth.user) return auth.response;
  const user = auth.user;
  try {
    const { type } = await req.json();

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

    const apiKey = getRequestApiKey(req);
    const content =
      type === "diet"
        ? await generateDietPlan(profile, { apiKey, locale: t.locale })
        : await generateTrainingPlan(profile, { apiKey, locale: t.locale });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonContent = jsonMatch ? jsonMatch[0] : content;

    const plan = await prisma.plan.create({
      data: {
        userId: user.id,
        type,
        content: jsonContent,
      },
    });

    return NextResponse.json({ plan });
  } catch (err) {
    return aiErrorResponse(err, t, t.errors.generateFailed);
  }
}

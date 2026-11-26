import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordWeight } from "@/lib/weight-store";
import { cookies } from "next/headers";
import { decryptSecret } from "@/lib/crypto";
import { telegramApi } from "@/lib/telegram-api";
import { deleteExpiredGuests, getCurrentUser, SESSION_COOKIE, startSession } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

/**
 * Updates the signed-in user's profile. With no session (a new visitor
 * finishing setup), creates a guest account and signs this browser into it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const existing = await getCurrentUser();

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
          isGuest: true,
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
      await startSession(user.id);
      // Housekeeping on sign-up: drop guests who haven't been back for a week.
      await deleteExpiredGuests().catch((err) => console.error("Guest cleanup failed:", err));
    }

    if (body.weight !== undefined && (!existing || existing.weight !== body.weight)) {
      // Changing the weight on the profile counts as today's weigh-in.
      await recordWeight(user.id, body.weight);
      revalidatePath("/dashboard");
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "保存用户失败" }, { status: 500 });
  }
}

/**
 * Deletes the current guest account and everything it owns (ON DELETE CASCADE),
 * detaches its Telegram bot, and signs the browser out. Non-guest accounts
 * can't be deleted here, so the owner's profile can't be wiped by accident.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: true });
  if (!user.isGuest) return NextResponse.json({ error: "Only guest accounts can be deleted here" }, { status: 403 });

  const bot = await prisma.botConfig.findUnique({ where: { userId: user.id } });
  if (bot) await telegramApi(decryptSecret(bot.telegramTokenEnc), "deleteWebhook").catch(() => {});

  await prisma.user.delete({ where: { id: user.id } });
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}

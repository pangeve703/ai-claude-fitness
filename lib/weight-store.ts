import { prisma } from "./prisma";
import { dateKey } from "./dates";

/**
 * Records a weigh-in for `userId`: one entry per day (a second weigh-in the
 * same day replaces the first). If this is the user's most recent entry, it
 * also becomes their profile weight, so the dashboard, the plans and the
 * calorie target all use the latest number.
 */
export async function recordWeight(userId: number, weight: number, date: string = dateKey()) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.weightLog.findFirst({
      where: { userId, date: { lt: date } },
      orderBy: { date: "desc" },
    });
    const sameDay = await tx.weightLog.findFirst({ where: { userId, date } });
    const log = sameDay
      ? await tx.weightLog.update({ where: { id: sameDay.id }, data: { weight } })
      : await tx.weightLog.create({ data: { userId, date, weight } });

    const newer = await tx.weightLog.findFirst({ where: { userId, date: { gt: date } } });
    const isLatest = !newer;
    if (isLatest) {
      await tx.user.update({ where: { id: userId }, data: { weight } });
    }
    return { log, previous: previous ? { date: previous.date, weight: previous.weight } : null, isLatest };
  });
}

/** The user's most recent weigh-in, or null if none yet. */
export async function latestWeighIn(userId: number) {
  const log = await prisma.weightLog.findFirst({ where: { userId }, orderBy: { date: "desc" } });
  return log ? { date: log.date, weight: log.weight } : null;
}

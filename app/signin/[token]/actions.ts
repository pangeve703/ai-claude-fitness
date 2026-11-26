"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken, setSessionCookie } from "@/lib/session";

const LINK_TTL_MS = 60 * 60 * 1000;

/**
 * Redeems a one-time sign-in link (from scripts/owner-link.mjs): the link's
 * session becomes this browser's session. Runs on a button press, not on
 * page load, so link previews in chat apps can't use the link up.
 */
export async function redeemSignInLink(token: string) {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  const valid = session && !session.claimedAt && Date.now() - session.createdAt.getTime() < LINK_TTL_MS;
  if (!valid) redirect("/signin/expired");

  // Claim atomically so the same link can't be used twice.
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, claimedAt: null },
    data: { claimedAt: new Date() },
  });
  if (count === 0) redirect("/signin/expired");

  await setSessionCookie(token);
  redirect("/dashboard");
}

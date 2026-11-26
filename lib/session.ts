import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

/**
 * Anonymous accounts. Each visitor gets their own user when they finish setup,
 * identified by a random token in an httpOnly cookie. Only the token's SHA-256
 * hash is stored, so a database leak doesn't reveal usable session tokens.
 *
 * Guests are deleted (with all their data, via ON DELETE CASCADE) after
 * GUEST_TTL_DAYS without a visit. Non-guest users, such as the owner's
 * original profile, are never deleted.
 */
export const SESSION_COOKIE = "fc_session";
export const GUEST_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// Only write lastSeenAt this often, so normal browsing doesn't write on every request.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isExpiredGuest(user: { isGuest: boolean; lastSeenAt: Date }, now = Date.now()): boolean {
  return user.isGuest && now - user.lastSeenAt.getTime() > GUEST_TTL_DAYS * DAY_MS;
}

/**
 * The signed-in user for this request, or null. Cached per request, so pages
 * and their helpers can call it freely.
 */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || isExpiredGuest(session.user)) return null;

  const { user } = session;
  if (Date.now() - user.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  }
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: the current user, or a redirect to /setup. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/setup");
  return user;
}

/** Sets the session cookie. Only callable from Route Handlers and Server Actions. */
export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400, // browsers cap at 400 days; the server enforces guest expiry
  });
}

/** Creates a session for `userId` and sets its cookie. */
export async function startSession(userId: number) {
  const token = newToken();
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId } });
  await setSessionCookie(token);
}

/** Deletes guests who haven't visited for GUEST_TTL_DAYS. Returns how many were removed. */
export async function deleteExpiredGuests(now = Date.now()): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: { isGuest: true, lastSeenAt: { lt: new Date(now - GUEST_TTL_DAYS * DAY_MS) } },
  });
  return count;
}

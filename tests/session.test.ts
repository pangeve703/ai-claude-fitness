import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { GUEST_TTL_DAYS, hashToken, isExpiredGuest, newToken } = await import("@/lib/session");

const DAY = 24 * 60 * 60 * 1000;

describe("session tokens", () => {
  it("are long, random and URL-safe", () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url
    expect(newToken()).not.toBe(a);
  });

  it("are stored only as a SHA-256 hash", () => {
    const token = newToken();
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("guest expiry", () => {
  const now = Date.parse("2026-11-27T00:00:00Z");

  it("expires guests after GUEST_TTL_DAYS without a visit", () => {
    expect(isExpiredGuest({ isGuest: true, lastSeenAt: new Date(now - (GUEST_TTL_DAYS - 1) * DAY) }, now)).toBe(false);
    expect(isExpiredGuest({ isGuest: true, lastSeenAt: new Date(now - (GUEST_TTL_DAYS + 1) * DAY) }, now)).toBe(true);
  });

  it("never expires non-guest users", () => {
    expect(isExpiredGuest({ isGuest: false, lastSeenAt: new Date(now - 365 * DAY) }, now)).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level checks with the database and session mocked: every query must be
 * scoped to the signed-in user, and signed-out requests must be rejected.
 */
const db = {
  foodLog: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  trainingLog: { updateMany: vi.fn() },
};
let currentUser: { id: number } | null = null;

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/i18n/server", async () => {
  const { dictionaries } = await import("@/lib/i18n/dictionaries");
  return { getDictionary: async () => dictionaries.en, getLocale: async () => "en" };
});

const food = await import("@/app/api/food-log/route");
const training = await import("@/app/api/training-log/route");

const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init) as never;

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: 7 };
});

describe("signed out", () => {
  it("rejects requests with 401", async () => {
    currentUser = null;
    const res = await food.GET(req("/api/food-log"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("not_signed_in");
    expect(db.foodLog.findMany).not.toHaveBeenCalled();
  });
});

describe("food log", () => {
  it("lists only the current user's entries", async () => {
    await food.GET(req("/api/food-log?date=2026-11-27"));
    expect(db.foodLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7, date: "2026-11-27" } })
    );
  });

  it("can't delete another user's entry", async () => {
    db.foodLog.deleteMany.mockResolvedValue({ count: 0 });
    const res = await food.DELETE(req("/api/food-log?id=42", { method: "DELETE" }));
    expect(db.foodLog.deleteMany).toHaveBeenCalledWith({ where: { id: 42, userId: 7 } });
    expect(res.status).toBe(404);
  });

  it("can't edit another user's entry", async () => {
    db.foodLog.findFirst.mockResolvedValue(null);
    const res = await food.PATCH(
      req("/api/food-log", { method: "PATCH", body: JSON.stringify({ id: 42, calories: 1 }) })
    );
    expect(db.foodLog.findFirst).toHaveBeenCalledWith({ where: { id: 42, userId: 7 } });
    expect(db.foodLog.update).not.toHaveBeenCalled();
    expect(res.status).toBe(404);
  });
});

describe("training log", () => {
  it("only toggles the current user's workouts", async () => {
    db.trainingLog.updateMany.mockResolvedValue({ count: 0 });
    const res = await training.PATCH(
      req("/api/training-log", { method: "PATCH", body: JSON.stringify({ id: 5, completed: true }) })
    );
    expect(db.trainingLog.updateMany).toHaveBeenCalledWith({ where: { id: 5, userId: 7 }, data: { completed: true } });
    expect(res.status).toBe(404);
  });
});

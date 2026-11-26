import { describe, expect, it } from "vitest";
import { parseWeight, weightChange } from "@/lib/weight";

describe("parseWeight", () => {
  it.each([
    [55.2, 55.2],
    ["55.2", 55.2],
    ["55,2", 55.2],
    ["55.2kg", 55.2],
    [" 55.2 KG ", 55.2],
    ["55.24", 55.2],
    ["60 公斤", 60],
    ["20", 20],
    ["300", 300],
  ])("%j → %d", (input, expected) => {
    expect(parseWeight(input)).toBe(expected);
  });

  it.each([["abc"], [""], ["19.9"], ["301"], ["-55"], ["55 lbs"], [null], [undefined], [Number.NaN]])(
    "rejects %j",
    (input) => {
      expect(parseWeight(input)).toBeNull();
    }
  );
});

describe("weightChange", () => {
  it("rounds to 0.1 kg without float noise", () => {
    expect(weightChange(55.2, 54.8)).toBe(-0.4);
    expect(weightChange(54.8, 55.3)).toBe(0.5);
    expect(weightChange(55, 55)).toBe(0);
  });
});

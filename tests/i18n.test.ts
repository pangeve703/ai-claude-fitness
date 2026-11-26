import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage } from "@/lib/i18n/config";
import { dictionaries } from "@/lib/i18n/dictionaries";

describe("localeFromAcceptLanguage", () => {
  it.each([
    ["zh-CN,zh;q=0.9,en;q=0.8", "zh"],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR,fr;q=0.9,zh;q=0.5", "zh"],
    ["en;q=0.3,zh-TW;q=0.8", "zh"],
    ["fr-FR", "en"],
    ["", "en"],
    [null, "en"],
  ])("%j → %s", (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });
});

/** Shape of a dictionary: every key path, plus whether the value is text or a function. */
function shape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return [`${path}:array(${value.length})`];
  if (typeof value === "function") return [`${path}:fn(${value.length})`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  }
  return [`${path}:${typeof value}`];
}

describe("dictionaries", () => {
  it("en and zh have identical keys, value kinds and function arities", () => {
    expect(shape(dictionaries.zh)).toEqual(shape(dictionaries.en));
  });

  it("has no empty strings", () => {
    for (const [locale, dict] of Object.entries(dictionaries)) {
      const empty = shape(dict).filter((s) => s.endsWith(":string") && !getPath(dict, s.split(":")[0]));
      expect(empty, `${locale} has empty strings`).toEqual([]);
    }
  });

  it("function entries return non-empty text", () => {
    expect(dictionaries.en.dashboard.entries(1)).toBe("1 entry");
    expect(dictionaries.en.dashboard.entries(2)).toBe("2 entries");
    expect(dictionaries.zh.dashboard.weightChange(-0.4, "11/20")).toBe("较 11/20 -0.4 kg");
    expect(dictionaries.en.dashboard.weightChange(0.5, "11/20")).toBe("+0.5 kg since 11/20");
  });
});

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

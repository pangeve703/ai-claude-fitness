import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hasAppSecret, MissingAppSecretError } from "@/lib/crypto";

const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TOKEN = "123456789:AAEXAMPLEexampleEXAMPLEexample_-12345";

describe("secret encryption (AES-256-GCM)", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.APP_SECRET;
    process.env.APP_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.APP_SECRET = original;
  });

  it("round-trips", () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN);
  });

  it("uses a fresh IV each time and never contains the plaintext", () => {
    const a = encryptSecret(TOKEN);
    const b = encryptSecret(TOKEN);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
    expect(a).not.toContain("EXAMPLE");
  });

  it("rejects tampered ciphertext", () => {
    const raw = Buffer.from(encryptSecret(TOKEN).slice(3), "base64");
    raw[raw.length - 1] ^= 1;
    expect(() => decryptSecret(`v1:${raw.toString("base64")}`)).toThrow();
  });

  it("can't decrypt with a different APP_SECRET", () => {
    const sealed = encryptSecret(TOKEN);
    process.env.APP_SECRET = SECRET.replace("0", "1");
    expect(() => decryptSecret(sealed)).toThrow();
  });

  it("requires a strong APP_SECRET", () => {
    process.env.APP_SECRET = "too-short";
    expect(hasAppSecret()).toBe(false);
    expect(() => encryptSecret(TOKEN)).toThrow(MissingAppSecretError);
  });
});

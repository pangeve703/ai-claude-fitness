import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption at rest for secrets the server must keep (the Telegram bot token
 * and the bot's Anthropic key). AES-256-GCM gives confidentiality plus
 * tamper detection. The key comes from the APP_SECRET env var, which never
 * touches the database. Generate one with:  openssl rand -hex 32
 *
 * Stored format: "v1:" + base64(iv[12] | authTag[16] | ciphertext)
 */
export class MissingAppSecretError extends Error {
  constructor() {
    super("APP_SECRET is not set (or shorter than 32 characters). Generate one with: openssl rand -hex 32");
    this.name = "MissingAppSecretError";
  }
}

function encryptionKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new MissingAppSecretError();
  // APP_SECRET is expected to be high-entropy random, so a plain hash is enough to size it to 32 bytes.
  return createHash("sha256").update(secret).digest();
}

export function hasAppSecret(): boolean {
  return (process.env.APP_SECRET?.length ?? 0) >= 32;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith("v1:")) throw new Error("Unknown secret format");
  const raw = Buffer.from(payload.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

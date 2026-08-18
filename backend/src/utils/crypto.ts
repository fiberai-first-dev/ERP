import crypto from "crypto";
import { env } from "../config/env.js";

function key() {
  return crypto.createHash("sha256").update(env.encryptionKey).digest();
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** True when payload looks like a complete aes-256-gcm blob (iv+tag+data). */
export function looksLikeEncryptedPayload(payload: string | null | undefined): boolean {
  if (!payload?.trim()) return false;
  try {
    const buf = Buffer.from(payload, "base64");
    return buf.length > 28;
  } catch {
    return false;
  }
}

export function decryptJson<T = Record<string, string>>(payload: string): T {
  const buf = Buffer.from(payload, "base64");
  if (buf.length <= 28) {
    throw new Error("Stored credentials are invalid. Reconnect the channel.");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }

  throw lastError;
}

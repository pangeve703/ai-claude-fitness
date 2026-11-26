"use client";

/**
 * Browser side of bring-your-own-key. The key lives only in this browser's
 * localStorage and is attached to AI requests via the x-anthropic-api-key
 * header (the name must match API_KEY_HEADER in lib/api-key.ts).
 */
const STORAGE_KEY = "anthropic_api_key";
const CHANGE_EVENT = "anthropic-api-key-change";

export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredApiKey(key: string | null) {
  if (key) localStorage.setItem(STORAGE_KEY, key.trim());
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onApiKeyChange(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/** Headers for a JSON request to an AI endpoint, including the visitor's key if set. */
export function aiHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = getStoredApiKey();
  if (key) headers["x-anthropic-api-key"] = key;
  return headers;
}

export function maskApiKey(key: string): string {
  return key.length <= 14 ? "sk-ant-…" : `${key.slice(0, 10)}…${key.slice(-4)}`;
}

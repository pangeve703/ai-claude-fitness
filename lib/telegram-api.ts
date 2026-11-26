/** Minimal Telegram Bot API client for setup calls (getMe, setWebhook, deleteWebhook). */
export class TelegramApiError extends Error {
  constructor(message: string, public readonly code: number) {
    super(message);
    this.name = "TelegramApiError";
  }
}

// Format check only (Telegram verifies the token itself): "<bot id>:<secret>".
export const BOT_TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;

export async function telegramApi<T>(token: string, method: string, params?: Record<string, unknown>): Promise<T> {
  // The token is part of the URL, so never log this URL.
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; description?: string; error_code?: number }
    | null;
  if (!data || !data.ok) {
    throw new TelegramApiError(data?.description ?? `Telegram ${method} failed`, data?.error_code ?? res.status);
  }
  return data.result;
}

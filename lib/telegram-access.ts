/**
 * Which Telegram chats a bot may serve. Pure functions, unit-tested in
 * tests/telegram-access.test.ts; applied in lib/telegram-webhook.ts before
 * any update reaches the bot's handlers.
 *
 *   - claimable: an app-connected bot nobody has messaged yet. The first
 *     *private* chat to message it becomes its owner chat.
 *   - fixed:     only these chat ids (the claimed chat, or TELEGRAM_ALLOWED_CHAT_IDS).
 *   - open:      env-var bot without an allow-list (kept for backward compatibility).
 */
export type ChatLock =
  | { kind: "claimable"; botId: string }
  | { kind: "fixed"; chatIds: string[] }
  | { kind: "open" };

export interface UpdateChat {
  id: string;
  type: string;
  /** True when the update is a message (so we may reply), false for button presses. */
  isMessage: boolean;
}

type ChatLike = { id?: number | string; type?: string } | undefined;

/** The chat an update came from (messages and inline-button presses), or null. */
export function extractChat(update: unknown): UpdateChat | null {
  const u = update as {
    message?: { chat?: ChatLike };
    edited_message?: { chat?: ChatLike };
    callback_query?: { message?: { chat?: ChatLike } };
  } | null;
  const fromMessage = u?.message?.chat ?? u?.edited_message?.chat;
  const chat = fromMessage ?? u?.callback_query?.message?.chat;
  if (!chat || chat.id === undefined || chat.id === null) return null;
  return { id: String(chat.id), type: chat.type ?? "unknown", isMessage: Boolean(fromMessage) };
}

export function checkChatAccess(lock: ChatLock, chat: UpdateChat | null): "allow" | "claim" | "deny" {
  if (lock.kind === "open") return "allow";
  if (!chat) return "deny";
  if (lock.kind === "fixed") return lock.chatIds.includes(chat.id) ? "allow" : "deny";
  // Claimable: only a private chat (not a group someone added the bot to) can become the owner.
  return chat.type === "private" && chat.isMessage ? "claim" : "deny";
}

/** Parses TELEGRAM_ALLOWED_CHAT_IDS ("123, -456"); null when unset or empty. */
export function parseAllowedChatIds(value: string | undefined): string[] | null {
  const ids = (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^-?\d+$/.test(s));
  return ids.length > 0 ? ids : null;
}

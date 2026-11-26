import { describe, expect, it } from "vitest";
import { checkChatAccess, extractChat, parseAllowedChatIds, type ChatLock } from "@/lib/telegram-access";

const privateMsg = (id: number) => ({ update_id: 1, message: { chat: { id, type: "private" }, text: "hi" } });
const groupMsg = (id: number) => ({ update_id: 1, message: { chat: { id, type: "group" }, text: "hi" } });
const button = (id: number) => ({ update_id: 1, callback_query: { id: "q", data: "df:1", message: { chat: { id, type: "private" } } } });

describe("extractChat", () => {
  it("reads messages, edits and button presses", () => {
    expect(extractChat(privateMsg(42))).toEqual({ id: "42", type: "private", isMessage: true });
    expect(extractChat({ edited_message: { chat: { id: 7, type: "private" } } })?.id).toBe("7");
    expect(extractChat(button(42))).toEqual({ id: "42", type: "private", isMessage: false });
  });

  it("keeps large and negative ids exact as strings", () => {
    expect(extractChat(groupMsg(-1001234567890))?.id).toBe("-1001234567890");
  });

  it("returns null for updates without a chat", () => {
    expect(extractChat({ update_id: 1 })).toBeNull();
    expect(extractChat(null)).toBeNull();
  });
});

describe("checkChatAccess", () => {
  const claimable: ChatLock = { kind: "claimable", botId: "abc" };
  const locked: ChatLock = { kind: "fixed", chatIds: ["42"] };

  it("lets the first private message claim an unclaimed bot", () => {
    expect(checkChatAccess(claimable, extractChat(privateMsg(42)))).toBe("claim");
  });

  it("never lets a group or a button press claim it", () => {
    expect(checkChatAccess(claimable, extractChat(groupMsg(-5)))).toBe("deny");
    expect(checkChatAccess(claimable, extractChat(button(42)))).toBe("deny");
  });

  it("serves only the locked chat afterwards", () => {
    expect(checkChatAccess(locked, extractChat(privateMsg(42)))).toBe("allow");
    expect(checkChatAccess(locked, extractChat(button(42)))).toBe("allow");
    expect(checkChatAccess(locked, extractChat(privateMsg(99)))).toBe("deny");
    expect(checkChatAccess(locked, null)).toBe("deny");
  });

  it("allows everything when the env bot has no allow-list", () => {
    expect(checkChatAccess({ kind: "open" }, extractChat(privateMsg(99)))).toBe("allow");
  });
});

describe("parseAllowedChatIds", () => {
  it("parses a comma-separated list and ignores junk", () => {
    expect(parseAllowedChatIds("123, -456 ,abc,")).toEqual(["123", "-456"]);
    expect(parseAllowedChatIds("")).toBeNull();
    expect(parseAllowedChatIds(undefined)).toBeNull();
  });
});

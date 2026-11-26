"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Bot, Check, ExternalLink, Loader2, Lock, LockOpen, Unplug } from "lucide-react";
import { aiHeaders, getStoredApiKey, onApiKeyChange } from "@/lib/byok-client";
import { useI18n } from "./I18nProvider";

interface BotStatus {
  connected: boolean;
  source: "app" | "env" | null;
  username: string | null;
  usesOwnAnthropicKey: boolean;
  chatLocked: boolean;
}

/**
 * Connect a Telegram bot from the app. The token goes to the server (Telegram
 * delivers messages there, not to the browser), together with the visitor's
 * Anthropic key from localStorage so the bot can call Claude.
 */
export default function TelegramBotCard() {
  const { t } = useI18n();
  const tg = t.telegram;
  const anthropicKey = useSyncExternalStore(onApiKeyChange, getStoredApiKey, () => null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [serverKey, setServerKey] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/telegram/setup").then((r) => r.json()).then(setStatus).catch(() => {});
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d) => setServerKey(Boolean(d.serverKeyConfigured)))
      .catch(() => {});
  }, []);

  async function call(method: "POST" | "DELETE") {
    setBusy(method === "POST" ? "connect" : "disconnect");
    setError(null);
    try {
      const res = await fetch("/api/telegram/setup", {
        method,
        headers: aiHeaders(),
        body: method === "POST" ? JSON.stringify({ botToken: token.trim() }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tg.failed);
      setStatus(data);
      setToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tg.failed);
    } finally {
      setBusy(null);
    }
  }

  const canConnect = Boolean(anthropicKey) || serverKey;

  return (
    <div id="telegram" className="card scroll-mt-4 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-aqua text-sky dark:bg-sky/20">
          <Bot size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{tg.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tg.desc}</p>
        </div>
      </div>

      {status === null ? (
        <div className="mt-3 flex justify-center py-2">
          <Loader2 size={16} className="animate-spin text-slate-400" />
        </div>
      ) : status.connected ? (
        <div className="mt-3 space-y-2">
          <div className="tint-aqua flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Check size={16} className="shrink-0" />
              <span className="truncate">
                {status.source === "env" ? tg.connectedViaEnv : status.username ? tg.connectedAs(status.username) : tg.connected}
              </span>
            </span>
            {status.source === "app" && (
              <button
                onClick={() => call("DELETE")}
                disabled={busy !== null}
                className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs text-slate-500 hover:bg-white hover:text-red-500 disabled:opacity-50 dark:hover:bg-white/10"
              >
                {busy === "disconnect" ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />}
                {busy === "disconnect" ? tg.disconnecting : tg.disconnect}
              </button>
            )}
          </div>
          <p className={`flex items-start gap-1.5 text-xs ${status.chatLocked ? "text-slate-500 dark:text-slate-400" : "text-amber-600 dark:text-amber-400"}`}>
            {status.chatLocked ? <Lock size={13} className="mt-px shrink-0" /> : <LockOpen size={13} className="mt-px shrink-0" />}
            {status.chatLocked
              ? tg.chatLocked
              : status.source === "env"
                ? tg.envUnlocked
                : tg.chatPending(status.username)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {status.usesOwnAnthropicKey ? tg.usesYourKey : tg.usesServerKey}
          </p>
          {status.username && (
            <a
              href={`https://t.me/${status.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-500 underline-offset-2 hover:text-ink hover:underline dark:hover:text-white"
            >
              {tg.openBot} <ExternalLink size={12} />
            </a>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
            <li>
              {tg.step1}{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                @BotFather
              </a>
            </li>
            <li>{tg.step2}</li>
          </ol>
          {!canConnect && <p className="text-xs text-amber-600 dark:text-amber-400">{tg.needsAnthropicKey}</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              call("POST");
            }}
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={tg.tokenPlaceholder}
              className="field flex-1 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={busy !== null || !token.trim() || !canConnect}
              className="btn-ink flex items-center gap-1 px-5 text-sm"
            >
              {busy === "connect" && <Loader2 size={16} className="animate-spin" />}
              {busy === "connect" ? tg.connecting : tg.connect}
            </button>
          </form>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">{tg.storageNote}</p>
    </div>
  );
}

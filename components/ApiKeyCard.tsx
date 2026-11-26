"use client";
import { useState, useSyncExternalStore } from "react";
import { KeyRound, Check, Trash2, Loader2, ExternalLink } from "lucide-react";
import { getStoredApiKey, maskApiKey, onApiKeyChange, setStoredApiKey } from "@/lib/byok-client";
import { useI18n } from "./I18nProvider";

/** Lets a visitor paste, verify, and remove their own Anthropic API key. */
export default function ApiKeyCard() {
  const { t } = useI18n();
  const k = t.apiKey;
  const storedKey = useSyncExternalStore(onApiKeyChange, getStoredApiKey, () => null);
  const [input, setInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveKey() {
    const key = input.trim();
    if (!key) return;
    setVerifying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai/status", {
        method: "POST",
        headers: { "x-anthropic-api-key": key },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStoredApiKey(key);
        setInput("");
        setMessage({ ok: true, text: k.verified });
      } else {
        setMessage({ ok: false, text: data.error || k.verifyFailed });
      }
    } catch {
      setMessage({ ok: false, text: k.networkError });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div id="api-key" className="card scroll-mt-4 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-peach text-flame dark:bg-flame/20">
          <KeyRound size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{k.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {k.desc}
          </p>
        </div>
      </div>

      {storedKey ? (
        <div className="tint-mint mt-3 flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-[#1f8a4c] dark:text-leaf">
            <Check size={16} /> {k.inUse} <code className="font-mono text-xs">{maskApiKey(storedKey)}</code>
          </span>
          <button
            onClick={() => {
              setStoredApiKey(null);
              setMessage(null);
            }}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-slate-500 hover:bg-white hover:text-red-500 dark:hover:bg-white/10"
          >
            <Trash2 size={14} /> {k.remove}
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveKey();
          }}
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="sk-ant-..."
            className="field flex-1 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={verifying || !input.trim()}
            className="btn-ink flex items-center gap-1 px-5 text-sm"
          >
            {verifying ? <Loader2 size={16} className="animate-spin" /> : null}
            {verifying ? k.verifying : t.common.save}
          </button>
        </form>
      )}

      {message && (
        <p className={`mt-2 text-xs ${message.ok ? "text-leaf" : "text-red-500"}`}>
          {message.text}
        </p>
      )}

      <a
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 underline-offset-2 hover:text-ink hover:underline dark:hover:text-white"
      >
        {k.getKey} <ExternalLink size={12} />
      </a>
    </div>
  );
}

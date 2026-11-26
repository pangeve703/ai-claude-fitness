"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { KeyRound } from "lucide-react";
import { getStoredApiKey, onApiKeyChange } from "@/lib/byok-client";
import { useI18n } from "./I18nProvider";
import ActionCard from "./ui/ActionCard";

/** Prompts the visitor to add a key when neither they nor the server has one. */
export default function ApiKeyBanner() {
  const { t } = useI18n();
  const storedKey = useSyncExternalStore(onApiKeyChange, getStoredApiKey, () => null);
  const [serverKey, setServerKey] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d) => setServerKey(Boolean(d.serverKeyConfigured)))
      .catch(() => setServerKey(false));
  }, []);

  if (storedKey || serverKey !== false) return null;

  return (
    <ActionCard
      tint="tint-peach"
      icon={<KeyRound size={20} className="text-flame" />}
      title={t.apiKey.bannerTitle}
      subtitle={t.apiKey.bannerDesc}
      href="/profile#api-key"
    />
  );
}

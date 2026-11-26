"use client";
import { useTransition } from "react";
import { Languages, Loader2 } from "lucide-react";
import { LOCALES } from "@/lib/i18n/config";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { setLocale } from "@/lib/i18n/actions";
import { useI18n } from "./I18nProvider";

/**
 * `compact`: one button that flips between languages (nav bar, setup header).
 * `segmented`: a labelled choice for the settings card on the profile page.
 */
export default function LanguageSwitcher({ variant = "compact" }: { variant?: "compact" | "segmented" }) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const change = (next: string) => startTransition(() => setLocale(next));

  if (variant === "compact") {
    const next = locale === "en" ? "zh" : "en";
    return (
      <button
        onClick={() => change(next)}
        disabled={pending}
        className="btn-soft flex items-center gap-1 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        aria-label={t.nav.switchLanguage}
        title={dictionaries[next].languageName}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
        {next === "zh" ? "中" : "EN"}
      </button>
    );
  }

  return (
    <div className="flex rounded-full bg-slate-100 p-1 dark:bg-white/5">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => l !== locale && change(l)}
          disabled={pending}
          aria-pressed={l === locale}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
            l === locale ? "bg-ink text-white shadow-sm dark:bg-white dark:text-ink" : "text-slate-500 dark:text-slate-300"
          }`}
        >
          {dictionaries[l].languageName}
        </button>
      ))}
    </div>
  );
}

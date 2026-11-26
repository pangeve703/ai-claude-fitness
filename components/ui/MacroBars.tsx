"use client";
import { useI18n } from "../I18nProvider";

const COLORS = { carbs: "bg-sky", protein: "bg-leaf", fat: "bg-flame" } as const;

/** Carb / protein / fat progress, coloured as in the reference (sky / leaf / flame). */
export default function MacroBars({
  eaten,
  target,
}: {
  eaten: { protein: number; carbs: number; fat: number };
  target: { protein: number; carbs: number; fat: number };
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-3 gap-4">
      {(["carbs", "protein", "fat"] as const).map((k) => {
        const p = Math.min(eaten[k] / Math.max(target[k], 1), 1);
        const over = eaten[k] > target[k];
        return (
          <div key={k} className="min-w-0">
            <div className="text-xs text-slate-600 dark:text-slate-300">{t.common.macros[k]}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
              <div className={`h-full rounded-full ${COLORS[k]}`} style={{ width: `${p * 100}%` }} />
            </div>
            <div className={`mt-1.5 text-xs ${over ? "text-flame" : ""}`}>
              <span className="font-semibold">{Math.round(eaten[k])}</span>
              <span className="text-slate-500 dark:text-slate-400"> / {Math.round(target[k])}g</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

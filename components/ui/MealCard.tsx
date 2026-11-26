"use client";
import Link from "next/link";
import { Coffee, Soup, Cookie, UtensilsCrossed, Plus, Pencil, Trash2 } from "lucide-react";
import type { MealKey } from "@/lib/nutrition";
import { useI18n } from "../I18nProvider";

export interface MealItem {
  id?: number;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string;
}

const STYLE: Record<MealKey, { tint: string; bar: string; Icon: typeof Coffee }> = {
  breakfast: { tint: "tint-aqua", bar: "bg-sky", Icon: Coffee },
  lunch: { tint: "tint-lilac", bar: "bg-[#8b7cf6]", Icon: Soup },
  snack: { tint: "tint-peach", bar: "bg-flame", Icon: Cookie },
  dinner: { tint: "tint-mint", bar: "bg-leaf", Icon: UtensilsCrossed },
};

/**
 * One meal: "Breakfast 185 / 547 kcal" with a progress bar against the meal's
 * share of the day, an add button, and the entries. Edit/delete appear when
 * handlers are given (Diet page); the dashboard shows it read-only.
 */
export default function MealCard({
  meal,
  items,
  budget,
  addHref,
  onAdd,
  onEdit,
  onDelete,
}: {
  meal: MealKey;
  items: MealItem[];
  budget: number;
  addHref?: string;
  onAdd?: () => void;
  onEdit?: (item: MealItem) => void;
  onDelete?: (item: MealItem) => void;
}) {
  const { t } = useI18n();
  const { tint, bar, Icon } = STYLE[meal];
  const total = Math.round(items.reduce((s, i) => s + i.calories, 0));
  const p = Math.min(total / Math.max(budget, 1), 1);
  const label = t.mealNames[meal];
  const addButton = (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white">
      <Plus size={16} />
    </span>
  );

  return (
    <section className={`${tint} rounded-[1.5rem] p-4`}>
      <div className="flex items-center gap-3">
        <Icon size={20} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold">{label}</h3>
            <span className={`text-xs ${total > budget ? "text-flame" : "text-slate-600 dark:text-slate-300"}`}>
              {total} / {budget} {t.common.kcal}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${p * 100}%` }} />
          </div>
        </div>
        {onAdd ? (
          <button onClick={onAdd} className="cute-tap" aria-label={t.diet.addTo(label)}>{addButton}</button>
        ) : addHref ? (
          <Link href={addHref} className="cute-tap" aria-label={t.diet.addTo(label)}>{addButton}</Link>
        ) : null}
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((item, i) => (
            <li key={item.id ?? i} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2.5 dark:bg-white/5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {item.foodName}
                  {item.source === "web_ai" && <span className="ml-1" title="AI">✨</span>}
                  {item.source?.startsWith("telegram") && <span className="ml-1" title="Telegram">📸</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {Math.round(item.calories)} {t.common.kcal} · P {Math.round(item.protein)}g · C {Math.round(item.carbs)}g · F {Math.round(item.fat)}g
                </div>
              </div>
              {onEdit && (
                <button onClick={() => onEdit(item)} className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-ink dark:hover:bg-white/10 dark:hover:text-white" aria-label={t.diet.editItem(item.foodName)}>
                  <Pencil size={15} />
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(item)} className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-red-500 dark:hover:bg-white/10" aria-label={t.diet.deleteItem(item.foodName)}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import AiQuickLog from "@/components/AiQuickLog";
import Sheet from "@/components/Sheet";
import { useI18n } from "@/components/I18nProvider";
import WeekStrip from "@/components/ui/WeekStrip";
import MacroBars from "@/components/ui/MacroBars";
import MealCard, { type MealItem } from "@/components/ui/MealCard";
import { MEAL_ORDER, type MealKey } from "@/lib/nutrition";

interface FoodLog extends MealItem {
  id: number;
  meal: string;
  source: string;
}

interface PlannedMeal {
  name: string;
  calories: number;
  description: string;
}

interface DietPlan {
  dailyCalories: number;
  macros: { protein: number; carbs: number; fat: number };
  weeklyPlan: Record<string, Record<string, PlannedMeal>>;
  tips: string[];
  forbidden: string[];
}

interface Props {
  foodLogs: FoodLog[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  plan: DietPlan | null;
  today: string;
  selected: string;
  targetCalories: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  mealBudgets: Record<MealKey, number>;
  /** 0 = Monday … 6 = Sunday, in the app time zone (computed on the server). */
  todayIndex: number;
  weekProgress: Record<string, number>;
  initialAdd: MealKey | null;
  initialTab: "log" | "plan";
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const PLAN_TINT: Record<string, string> = { breakfast: "tint-aqua", lunch: "tint-lilac", snack: "tint-peach", dinner: "tint-mint" };

type FoodForm = { meal: string; foodName: string; calories: string; protein: string; carbs: string; fat: string };
const emptyForm = (meal: string): FoodForm => ({ meal, foodName: "", calories: "", protein: "", carbs: "", fat: "" });

export default function DietClient(props: Props) {
  const { foodLogs, totals, plan, today, selected, targetCalories } = props;
  const router = useRouter();
  const { t } = useI18n();
  const d = t.diet;
  const fmt = (n: number) => Math.round(n).toLocaleString(t.intl);

  const [activeTab, setActiveTab] = useState<"log" | "plan">(props.initialTab);
  const [planDay, setPlanDay] = useState(props.todayIndex);
  const [addForm, setAddForm] = useState<FoodForm | null>(props.initialAdd ? emptyForm(props.initialAdd) : null);
  const [addingFood, setAddingFood] = useState(false);
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [editForm, setEditForm] = useState<FoodForm>(emptyForm("breakfast"));
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingLog, setDeletingLog] = useState<FoodLog | null>(null);
  const [deletingFood, setDeletingFood] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isToday = selected === today;
  const toBody = (f: FoodForm) => ({
    meal: f.meal,
    foodName: f.foodName,
    calories: parseFloat(f.calories),
    protein: parseFloat(f.protein) || 0,
    carbs: parseFloat(f.carbs) || 0,
    fat: parseFloat(f.fat) || 0,
  });

  async function request(url: string, init: RequestInit, failure: string) {
    setError(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || failure);
    }
    router.refresh();
  }

  async function addFood() {
    if (!addForm || !addForm.foodName || !addForm.calories) return;
    setAddingFood(true);
    try {
      await request("/api/food-log", { method: "POST", body: JSON.stringify({ ...toBody(addForm), date: selected }) }, d.addFailed);
      setAddForm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingFood(false);
    }
  }

  function startEdit(item: MealItem) {
    const log = item as FoodLog;
    setEditingLog(log);
    setEditForm({
      meal: log.meal,
      foodName: log.foodName,
      calories: String(log.calories),
      protein: String(log.protein),
      carbs: String(log.carbs),
      fat: String(log.fat),
    });
  }

  async function saveEdit() {
    if (!editingLog || !editForm.foodName || !editForm.calories) return;
    setSavingEdit(true);
    try {
      await request("/api/food-log", { method: "PATCH", body: JSON.stringify({ id: editingLog.id, ...toBody(editForm) }) }, d.updateFailed);
      setEditingLog(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deletingLog) return;
    setDeletingFood(true);
    try {
      await request(`/api/food-log?id=${deletingLog.id}`, { method: "DELETE" }, d.deleteFailed);
      setDeletingLog(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingFood(false);
    }
  }

  /** "+ Track" on a planned meal logs it for the day being viewed. */
  async function trackPlanned(key: string, meal: string, planned: PlannedMeal) {
    setTracking(key);
    try {
      await request(
        "/api/food-log",
        {
          method: "POST",
          body: JSON.stringify({
            date: selected,
            meal: MEAL_ORDER.includes(meal as MealKey) ? meal : "snack",
            foodName: String(planned.name).slice(0, 120),
            calories: Math.max(0, Number(planned.calories) || 0),
          }),
        },
        d.addFailed
      );
      setTracked((s) => new Set(s).add(key));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTracking(null);
    }
  }

  const pct = Math.min(totals.calories / Math.max(targetCalories, 1), 1);
  const dayPlan = plan?.weeklyPlan?.[DAYS[planDay]];

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{d.title}</h1>
        <div className="flex rounded-full bg-white/70 p-1 shadow-sm dark:bg-white/5">
          {(["log", "plan"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-ink text-white dark:bg-white dark:text-ink" : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {tab === "log" ? d.tabLog : d.tabPlan}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {activeTab === "log" && (
        <>
          <WeekStrip selected={selected} today={today} basePath="/diet" progress={props.weekProgress} />

          <section className="card-hero p-5">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{isToday ? d.todayCalories : d.dayCalories}</span>
              <span className="text-sm">
                <span className="font-semibold">{fmt(totals.calories)}</span>
                <span className="text-slate-500 dark:text-slate-400"> / {fmt(targetCalories)} {t.common.kcal}</span>
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
              <div
                className={`h-full rounded-full ${totals.calories > targetCalories ? "bg-flame" : "bg-ink dark:bg-white"}`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <div className="mt-5">
              <MacroBars eaten={totals} target={props.macroTargets} />
            </div>
          </section>

          <AiQuickLog today={selected} />

          <div className="space-y-3">
            {MEAL_ORDER.map((meal) => (
              <MealCard
                key={meal}
                meal={meal}
                budget={props.mealBudgets[meal]}
                items={foodLogs.filter((l) => l.meal === meal)}
                onAdd={() => setAddForm(emptyForm(meal))}
                onEdit={startEdit}
                onDelete={(item) => setDeletingLog(item as FoodLog)}
              />
            ))}
          </div>
          {foodLogs.length === 0 && <p className="text-center text-sm text-slate-500 dark:text-slate-400">{d.emptyHint}</p>}
        </>
      )}

      {activeTab === "plan" && (
        <>
          {!plan ? (
            <div className="card py-12 text-center">
              <p className="text-4xl">🥗</p>
              <p className="mt-2 font-semibold">{d.noPlan}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{d.noPlanHint}</p>
            </div>
          ) : (
            <>
              <section className="card-hero p-5">
                <p className="text-sm text-slate-600 dark:text-slate-300">{d.dailyTarget}</p>
                <p className="mt-1 text-2xl font-bold">
                  {fmt(plan.dailyCalories)} <span className="text-sm font-medium text-slate-500">{t.common.kcal}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {(["carbs", "protein", "fat"] as const).map((k) => (
                    <span key={k} className="rounded-full bg-white/80 px-3 py-1 dark:bg-white/10">
                      {t.common.macros[k]} <b>{plan.macros[k]}g</b>
                    </span>
                  ))}
                </div>
              </section>

              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {DAYS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPlanDay(i)}
                    aria-pressed={planDay === i}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      planDay === i ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-white/85 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                    }`}
                  >
                    {t.days[i]}
                    {i === props.todayIndex && <span className="ml-1 text-[10px] opacity-70">•</span>}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {dayPlan &&
                  MEAL_ORDER.filter((m) => dayPlan[m]).map((meal) => {
                    const planned = dayPlan[meal];
                    const key = `${planDay}-${meal}`;
                    const done = tracked.has(key);
                    return (
                      <div key={meal} className={`${PLAN_TINT[meal]} flex flex-col rounded-[1.5rem] p-4`}>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.mealNames[meal]}</span>
                        <span className="mt-1 font-semibold leading-snug">{planned.name}</span>
                        <span className="mt-1 line-clamp-3 flex-1 text-xs text-slate-600 dark:text-slate-300">{planned.description}</span>
                        <span className="mt-2 w-fit rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium dark:bg-white/10">
                          🔥 {planned.calories} {t.common.kcal}
                        </span>
                        <button
                          onClick={() => trackPlanned(key, meal, planned)}
                          disabled={tracking !== null || done}
                          className="btn-ink mt-3 flex items-center justify-center gap-1 py-2 text-sm"
                        >
                          {tracking === key ? <Loader2 size={14} className="animate-spin" /> : done ? <Check size={14} /> : <Plus size={14} />}
                          {done ? d.tracked : d.track}
                        </button>
                      </div>
                    );
                  })}
              </div>

              {plan.tips?.length > 0 && (
                <section className="card p-4">
                  <p className="mb-2 font-semibold">{d.tips}</p>
                  <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {plan.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {plan.forbidden?.length > 0 && (
                <section className="tint-peach rounded-[1.5rem] p-4">
                  <p className="mb-2 font-semibold">{d.avoid}</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.forbidden.map((f, i) => (
                      <span key={i} className="rounded-full bg-white/80 px-3 py-1 text-xs dark:bg-white/10">
                        {f}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {addForm && (
        <Sheet
          title={d.addTitle}
          subtitle={isToday ? d.addSubtitle : d.addingFor(selected)}
          onClose={() => setAddForm(null)}
          busy={addingFood}
          footer={
            <button
              onClick={addFood}
              disabled={addingFood || !addForm.foodName || !addForm.calories}
              className="btn-ink flex flex-1 items-center justify-center gap-2 py-3"
            >
              {addingFood ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {addingFood ? d.adding : d.add}
            </button>
          }
        >
          <FoodFields form={addForm} onChange={(patch) => setAddForm((p) => (p ? { ...p, ...patch } : p))} />
        </Sheet>
      )}

      {editingLog && (
        <Sheet
          title={d.editTitle}
          subtitle={d.editSubtitle}
          onClose={() => setEditingLog(null)}
          busy={savingEdit}
          footer={
            <button
              onClick={saveEdit}
              disabled={savingEdit || !editForm.foodName || !editForm.calories}
              className="btn-ink flex flex-1 items-center justify-center gap-2 py-3"
            >
              {savingEdit ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {savingEdit ? t.common.saving : t.common.save}
            </button>
          }
        >
          <FoodFields form={editForm} onChange={(patch) => setEditForm((p) => ({ ...p, ...patch }))} />
        </Sheet>
      )}

      {deletingLog && (
        <Sheet
          title={d.deleteTitle}
          subtitle={d.deleteBody(deletingLog.foodName, Math.round(deletingLog.calories))}
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/50">
              <Trash2 size={20} />
            </div>
          }
          onClose={() => setDeletingLog(null)}
          busy={deletingFood}
          footer={
            <>
              <button onClick={() => setDeletingLog(null)} disabled={deletingFood} className="btn-soft flex-1 py-3 text-sm">
                {t.common.cancel}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingFood}
                className="flex-1 rounded-full bg-red-500 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingFood ? d.deleting : d.confirmDelete}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

/** Labelled fields shared by the add and edit sheets. */
function FoodFields({ form, onChange }: { form: FoodForm; onChange: (patch: Partial<FoodForm>) => void }) {
  const { t } = useI18n();
  const d = t.diet;
  const numbers = [
    { key: "calories", label: `${d.calories} (${t.common.kcal})` },
    { key: "protein", label: d.proteinG },
    { key: "carbs", label: d.carbsG },
    { key: "fat", label: d.fatG },
  ] as const;

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-500">{d.meal}</span>
        <div className="grid grid-cols-4 gap-1.5">
          {MEAL_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ meal: m })}
              aria-pressed={form.meal === m}
              className={`rounded-full py-2 text-xs font-medium transition-colors ${
                form.meal === m ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
              }`}
            >
              {t.mealNames[m]}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">{d.foodName}</span>
        <input className="field" maxLength={120} value={form.foodName} onChange={(e) => onChange({ foodName: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        {numbers.map(({ key, label }) => (
          <label key={key} className="block min-w-0">
            <span className="mb-1 block truncate text-xs font-medium text-slate-500">{label}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              className="field"
              value={form[key]}
              onChange={(e) => onChange({ [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

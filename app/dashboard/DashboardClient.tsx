"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Bot, ChevronRight, Flame, Loader2, Lock, Pencil, Scale, Utensils } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line } from "recharts";
import { useI18n } from "@/components/I18nProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ApiKeyBanner from "@/components/ApiKeyBanner";
import Sheet from "@/components/Sheet";
import WeekStrip from "@/components/ui/WeekStrip";
import CalorieRing from "@/components/ui/CalorieRing";
import MacroBars from "@/components/ui/MacroBars";
import MealCard, { type MealItem } from "@/components/ui/MealCard";
import ActionCard from "@/components/ui/ActionCard";
import { aiHeaders } from "@/lib/byok-client";
import { shortLabel } from "@/lib/dates";
import { bmiCategory, MEAL_ORDER, type MealKey } from "@/lib/nutrition";
import { parseWeight, weightChange } from "@/lib/weight";

type Macros = { protein: number; carbs: number; fat: number };
type PlanState = { exists: boolean; lockedUntil: string | null };

interface Props {
  user: { name: string; weight: number; goal: string; targetWeight: number | null };
  today: string;
  selected: string;
  bmi: number;
  streak: number;
  eaten: Macros & { calories: number };
  burned: number;
  workouts: { done: number; total: number };
  foodLogs: (MealItem & { meal: string })[];
  targetCalories: number;
  macroTargets: Macros;
  mealBudgets: Record<MealKey, number>;
  weekProgress: Record<string, number>;
  chartData: { date: string; consumed: number; burned: number }[];
  weightChartData: { date: string; weight: number }[];
  lastWeighIn: { date: string; weight: number } | null;
  plans: { diet: PlanState; training: PlanState };
  telegramBot: { connected: boolean; username: string | null };
}

const tooltipStyle = { borderRadius: 14, border: "none", boxShadow: "0 8px 24px rgba(30,60,90,0.15)", fontSize: 12 };

export default function DashboardClient(props: Props) {
  const { user, today, selected, eaten, targetCalories, plans } = props;
  const router = useRouter();
  const { t } = useI18n();
  const d = t.dashboard;
  const fmt = (n: number) => Math.round(n).toLocaleString(t.intl);

  const [generating, setGenerating] = useState<"diet" | "training" | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Weigh-in sheet
  const [weightOpen, setWeightOpen] = useState(false);
  const [newWeight, setNewWeight] = useState(String(props.lastWeighIn?.weight ?? user.weight));
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [weighIn, setWeighIn] = useState(props.lastWeighIn);
  const [weightDelta, setWeightDelta] = useState<{ diff: number; since: string } | null>(null);

  const isToday = selected === today;
  const remaining = targetCalories - (eaten.calories - props.burned);
  const over = remaining < 0;
  const goalLabel = (t.goals as Record<string, { label: string }>)[user.goal]?.label ?? user.goal;
  const bmiLabel = d.bmi[bmiCategory(props.bmi, t.bmiStandard)];
  const selectedLabel = new Date(`${selected}T12:00:00Z`).toLocaleDateString(t.intl, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  async function generatePlan(type: "diet" | "training") {
    setPlanError(null);
    setGenerating(type);
    try {
      const res = await fetch("/api/plan", { method: "POST", headers: aiHeaders(), body: JSON.stringify({ type }) });
      const data = await res.json();
      if (res.ok) {
        router.push(type === "diet" ? "/diet?tab=plan" : "/training?tab=plan");
        router.refresh();
      } else setPlanError(data.error || d.generateFailed);
    } catch {
      setPlanError(d.networkError);
    } finally {
      setGenerating(null);
    }
  }

  /** Records today's weigh-in (POST /api/weight-log), which also updates the profile weight. */
  async function saveWeight() {
    const val = parseWeight(newWeight);
    if (val === null) return setWeightError(t.errors.invalidWeight);
    setSavingWeight(true);
    setWeightError(null);
    try {
      const res = await fetch("/api/weight-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWeighIn({ date: data.log.date, weight: val });
      setWeightDelta(data.previous ? { diff: weightChange(data.previous.weight, val), since: data.previous.date } : null);
      setWeightOpen(false);
      router.refresh();
    } catch (e) {
      setWeightError(e instanceof Error && e.message ? e.message : t.errors.saveFailed);
    } finally {
      setSavingWeight(false);
    }
  }

  const weighInSubtitle = !weighIn
    ? d.noWeighIn
    : `${weighIn.weight} kg · ${
        weightDelta && weightDelta.diff !== 0
          ? d.weightChange(weightDelta.diff, shortLabel(weightDelta.since))
          : weighIn.date === today
            ? d.weighedToday
            : d.lastWeighIn(shortLabel(weighIn.date))
      }`;

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5">
      {/* Header */}
      <header className="flex items-center justify-between gap-2">
        <Link href="/profile" className="btn-soft flex min-w-0 items-center gap-2 py-1.5 pl-1.5 pr-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-deep to-lilac-deep text-sm font-bold text-ink">
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="truncate text-sm font-semibold">{d.greeting(user.name)}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span className="btn-soft flex items-center gap-1 px-3 py-1.5 text-sm font-semibold" title={d.streakTitle(props.streak)}>
            <Flame size={16} className="text-flame" fill="currentColor" /> {props.streak}
          </span>
          <LanguageSwitcher />
        </div>
      </header>

      <WeekStrip selected={selected} today={today} basePath="/dashboard" progress={props.weekProgress} />

      {/* Summary */}
      <section className="card-hero p-5">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          {d.planTitle(goalLabel, fmt(targetCalories))}
          <Link href="/profile" aria-label={t.profile.editProfile} className="text-slate-500 hover:text-ink dark:hover:text-white">
            <Pencil size={14} />
          </Link>
        </h1>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
          {isToday ? d.todayBadge : selectedLabel} · BMI {props.bmi.toFixed(1)} {bmiLabel}
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="space-y-4">
            <Stat label={d.consumed} icon={<Utensils size={13} className="text-sky" />} value={fmt(eaten.calories)} unit={t.common.kcal} />
            <Stat label={d.burned} icon={<Flame size={13} className="text-flame" />} value={fmt(props.burned)} unit={t.common.kcal} />
          </div>
          <CalorieRing
            eaten={eaten.calories - props.burned}
            target={targetCalories}
            value={fmt(Math.abs(remaining))}
            label={over ? d.kcalOver : d.kcalLeft}
            over={over}
          />
        </div>

        <div className="mt-5">
          <MacroBars eaten={eaten} target={props.macroTargets} />
        </div>
      </section>

      <ApiKeyBanner />

      {/* Quick actions */}
      <div className="space-y-3">
        <ActionCard
          tint="tint-lilac"
          icon={<Scale size={20} className="text-[#8b7cf6]" />}
          title={d.logWeight}
          subtitle={weighInSubtitle}
          onClick={() => {
            setWeightError(null);
            setWeightOpen(true);
          }}
        />
        <ActionCard
          tint="tint-aqua"
          icon={<Flame size={20} className="text-flame" />}
          title={d.torchTitle}
          subtitle={d.torchSubtitle(fmt(props.burned), props.workouts.done, props.workouts.total)}
          href="/training"
        />
      </div>

      {/* Meals */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold">{d.meals}</h2>
          <Link href="/diet?tab=plan" className="flex items-center text-sm text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white">
            {t.diet.tabPlan} <ChevronRight size={16} />
          </Link>
        </div>
        <div className="space-y-3">
          {MEAL_ORDER.map((meal) => (
            <MealCard
              key={meal}
              meal={meal}
              budget={props.mealBudgets[meal]}
              items={props.foodLogs.filter((l) => l.meal === meal)}
              addHref={`/diet?${isToday ? "" : `date=${selected}&`}add=${meal}`}
            />
          ))}
        </div>
      </section>

      {/* Trends */}
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">{d.weekCalories}</h2>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={props.chartData} barSize={12} barGap={3} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.12)" }}
              contentStyle={tooltipStyle}
              formatter={(v, name) => [`${v ?? 0} ${t.common.kcal}`, name === "consumed" ? d.intake : d.burned]}
            />
            <ReferenceLine y={targetCalories} stroke="#43c068" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" />
            <Bar dataKey="consumed" fill="#57a7f2" radius={[6, 6, 6, 6]} />
            <Bar dataKey="burned" fill="#ff7a3d" radius={[6, 6, 6, 6]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <Legend color="bg-sky" label={d.intake} />
          <Legend color="bg-flame" label={d.burned} />
          <Legend color="bg-leaf" label={d.target} dashed />
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{d.weight30}</h2>
          {props.weightChartData.length >= 2 &&
            (() => {
              const diff = weightChange(props.weightChartData[0].weight, props.weightChartData[props.weightChartData.length - 1].weight);
              return (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    diff === 0 ? "bg-slate-100 text-slate-500 dark:bg-white/10" : diff > 0 ? "bg-peach text-flame" : "bg-mint text-leaf"
                  }`}
                >
                  {diff === 0 ? d.flat : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)} kg`}
                </span>
              );
            })()}
        </div>
        {props.weightChartData.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            {d.noWeight}
            <br />
            <span className="text-xs">{d.noWeightHint}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={props.weightChartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} kg`, d.weightLabel]} />
              {user.targetWeight != null && (
                <ReferenceLine
                  y={user.targetWeight}
                  stroke="#8b7cf6"
                  strokeDasharray="4 4"
                  label={{ value: d.targetWeightRef(user.targetWeight), position: "insideTopRight", fontSize: 10, fill: "#8b7cf6" }}
                />
              )}
              <Line type="monotone" dataKey="weight" stroke="#8b7cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* AI plans */}
      <section>
        <h2 className="mb-3 px-1 text-lg font-semibold">{d.aiPlans}</h2>
        {planError && (
          <div className="mb-3 flex gap-3 rounded-[1.25rem] bg-red-50 p-4 text-sm dark:bg-red-950/40">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">{d.planFailed}</p>
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{planError}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { type: "diet", emoji: "🥗", label: d.dietPlan, tint: "tint-mint", href: "/diet?tab=plan" },
              { type: "training", emoji: "💪", label: d.trainingPlan, tint: "tint-aqua", href: "/training?tab=plan" },
            ] as const
          ).map(({ type, emoji, label, tint, href }) => {
            const state = plans[type];
            return (
              <div key={type} className={`${tint} flex flex-col rounded-[1.5rem] p-4`}>
                <span className="text-2xl">{emoji}</span>
                <span className="mt-2 font-semibold">{label}</span>
                <span className="mt-0.5 flex-1 text-xs text-slate-600 dark:text-slate-300">
                  {generating === type
                    ? d.generating
                    : state.lockedUntil
                      ? d.lockedUntil(state.lockedUntil)
                      : state.exists
                        ? d.viewPlan
                        : d.clickToGenerate}
                </span>
                <div className="mt-3 flex gap-2">
                  {state.exists && (
                    <Link href={href} className="btn-soft flex-1 py-2 text-center text-xs">
                      {d.view}
                    </Link>
                  )}
                  {!state.lockedUntil ? (
                    <button
                      onClick={() => generatePlan(type)}
                      disabled={generating !== null}
                      className="btn-ink flex flex-1 items-center justify-center gap-1 py-2 text-xs"
                    >
                      {generating === type && <Loader2 size={12} className="animate-spin" />}
                      {state.exists ? d.regenerate : d.generate}
                    </button>
                  ) : (
                    !state.exists && (
                      <span className="flex flex-1 items-center justify-center py-2 text-slate-500">
                        <Lock size={12} />
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Telegram */}
      <section className="tint-aqua flex items-center gap-3 rounded-[1.5rem] p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 dark:bg-white/10">
          <Bot size={20} className="text-sky" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{d.telegramTitle}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {props.telegramBot.connected ? d.telegramHint : t.telegram.dashboardHint}
          </div>
        </div>
        {props.telegramBot.connected ? (
          props.telegramBot.username ? (
            <a href={`https://t.me/${props.telegramBot.username}`} target="_blank" rel="noreferrer" className="btn-soft shrink-0 px-3 py-1.5 text-xs">
              🟢 @{props.telegramBot.username}
            </a>
          ) : (
            <span className="btn-soft shrink-0 px-3 py-1.5 text-xs">🟢 {t.telegram.connected}</span>
          )
        ) : (
          <Link href="/profile#telegram" className="btn-ink shrink-0 px-4 py-1.5 text-xs">
            {t.telegram.connect}
          </Link>
        )}
      </section>

      {weightOpen && (
        <Sheet
          title={d.logWeight}
          subtitle={weighIn ? d.lastWeighIn(`${shortLabel(weighIn.date)} · ${weighIn.weight} kg`) : d.noWeighIn}
          onClose={() => setWeightOpen(false)}
          busy={savingWeight}
          footer={
            <button onClick={saveWeight} disabled={savingWeight} className="btn-ink flex flex-1 items-center justify-center gap-2 py-3 text-sm">
              {savingWeight && <Loader2 size={16} className="animate-spin" />}
              {t.common.save}
            </button>
          }
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">{d.todayWeight}</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                autoFocus
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveWeight()}
                className="field pr-12 text-2xl font-semibold"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">kg</span>
            </div>
          </label>
          {weightError && <p className="mt-2 text-xs text-red-500">{weightError}</p>}
        </Sheet>
      )}
    </div>
  );
}

function Stat({ label, icon, value, unit }: { label: string; icon: React.ReactNode; value: string; unit: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        {label} {icon}
      </div>
      <div className="text-2xl font-bold">
        {value} <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block ${dashed ? "h-0.5 w-3" : "h-2 w-2 rounded-full"} ${color}`} />
      {label}
    </span>
  );
}

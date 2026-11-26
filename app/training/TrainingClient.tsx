"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, CircleCheck, Circle, Clock, Flame, Loader2, Timer, Trophy } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { caloriesBurned, parseWorkoutNotes } from "@/lib/workouts";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface Exercise {
  exercise: string;
  sets?: number;
  reps?: string;
  duration: number;
  intensity: string;
  notes?: string;
}

interface TrainingPlan {
  weeklyPlan: Record<string, Exercise[]>;
  tips: string[];
  warmup: string;
  cooldown: string;
  weeklyGoal: string;
}

interface TrainingLog {
  id: number;
  exercise: string;
  duration: number;
  completed: boolean;
  notes?: string | null;
}

interface Props {
  trainingLogs: TrainingLog[];
  plan: TrainingPlan | null;
  today: string;
  /** 0 = Monday … 6 = Sunday, in the app time zone (computed on the server). */
  todayIndex: number;
  initialTab: "today" | "plan";
}

type Intensity = "low" | "medium" | "high";
const INTENSITY_STYLE: Record<Intensity, string> = {
  low: "bg-mint text-[#1f8a4c] dark:bg-leaf/20 dark:text-leaf",
  medium: "bg-lemon text-[#9a6b00] dark:bg-yellow-500/20 dark:text-yellow-300",
  high: "bg-peach text-flame dark:bg-flame/20",
};

/** Plans store a stable enum (low/medium/high); older plans stored 低/中/高. */
function normalizeIntensity(value: string | undefined): Intensity | null {
  const v = (value || "").trim().toLowerCase();
  if (v === "low" || v === "低") return "low";
  if (v === "medium" || v === "中") return "medium";
  if (v === "high" || v === "高") return "high";
  return null;
}

export default function TrainingClient({ trainingLogs, plan, today, todayIndex, initialTab }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const tr = t.training;
  const [activeTab, setActiveTab] = useState<"today" | "plan">(initialTab);
  const [planDay, setPlanDay] = useState(todayIndex);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const totalMinutes = trainingLogs.reduce((sum, l) => sum + l.duration, 0);
  const completedCount = trainingLogs.filter((l) => l.completed).length;
  const burned = caloriesBurned(trainingLogs);
  const todayPlan = plan?.weeklyPlan?.[DAYS[todayIndex]] || [];
  const isRestDay = todayPlan.length === 0;

  async function toggleComplete(id: number, completed: boolean) {
    await fetch("/api/training-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
    router.refresh();
  }

  async function loadTodayPlan() {
    setLoading(true);
    try {
      for (const ex of todayPlan) {
        await fetch("/api/training-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: today,
            exercise: (ex.exercise + (ex.sets ? tr.setsRepsCompact(ex.sets, ex.reps ?? "") : "")).slice(0, 120),
            duration: Math.max(0, Math.round(Number(ex.duration) || 0)),
            notes: typeof ex.notes === "string" ? ex.notes : undefined,
          }),
        });
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tr.title}</h1>
        <div className="flex rounded-full bg-white/70 p-1 shadow-sm dark:bg-white/5">
          {(["today", "plan"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-ink text-white dark:bg-white dark:text-ink" : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {tab === "today" ? tr.tabToday : tr.tabPlan}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "today" && (
        <>
          <section className="card-hero grid grid-cols-3 gap-2 p-4 text-center">
            <Stat icon={<Trophy size={16} className="text-leaf" />} value={`${completedCount}/${trainingLogs.length}`} label={tr.completed} />
            <Stat icon={<Timer size={16} className="text-sky" />} value={String(totalMinutes)} label={tr.minutes} />
            <Stat icon={<Flame size={16} className="text-flame" />} value={String(burned)} label={tr.burnedKcal} />
          </section>

          {plan && (
            <section className={`${isRestDay ? "tint-lilac" : "tint-aqua"} rounded-[1.5rem] p-4`}>
              <p className="font-semibold">{isRestDay ? tr.restDay : tr.todayPlan(todayPlan.length)}</p>
              {!isRestDay && (
                <>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{todayPlan.map((e) => e.exercise).join(" · ")}</p>
                  {trainingLogs.length === 0 && (
                    <button onClick={loadTodayPlan} disabled={loading} className="btn-ink mt-3 flex items-center gap-2 px-5 py-2 text-sm">
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      {tr.loadToday}
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {trainingLogs.length === 0 ? (
            <div className="card py-10 text-center">
              <p className="text-4xl">🏋️</p>
              <p className="mt-2 font-semibold">{tr.empty}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan && !isRestDay ? tr.emptyHint : tr.emptyHintCamera}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trainingLogs.map((log) => {
                const notes = parseWorkoutNotes(log.notes);
                const chips = [
                  notes?.distance && `📍 ${notes.distance}`,
                  notes?.pace && `⚡ ${notes.pace}`,
                  notes?.heartRate && `❤️ ${notes.heartRate}`,
                  notes?.caloriesBurned && `🔥 ${notes.caloriesBurned} ${t.common.kcal}`,
                ].filter(Boolean) as string[];
                const details = notes?.details || (!notes && log.notes) || null;
                const expanded = expandedLogId === log.id;
                return (
                  <div key={log.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleComplete(log.id, !log.completed)}
                        aria-label={log.completed ? tr.markUndone : tr.markDone}
                        className="mt-0.5 shrink-0"
                      >
                        {log.completed ? <CircleCheck size={26} className="text-leaf" /> : <Circle size={26} className="text-slate-300 dark:text-slate-600" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`font-semibold ${log.completed ? "text-slate-400 line-through" : ""}`}>{log.exercise}</span>
                          <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                            <Clock size={13} /> {log.duration} {t.common.min}
                          </span>
                        </div>
                        {chips.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {chips.map((c) => (
                              <span key={c} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        {details && (
                          <button
                            onClick={() => setExpandedLogId(expanded ? null : log.id)}
                            className="mt-2 flex items-center gap-0.5 text-xs text-slate-500 hover:text-ink dark:hover:text-white"
                          >
                            {tr.details} {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                        {expanded && details && (
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-500 dark:text-slate-400">{details}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "plan" && (
        <>
          {!plan ? (
            <div className="card py-12 text-center">
              <p className="text-4xl">💪</p>
              <p className="mt-2 font-semibold">{tr.noPlan}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tr.noPlanHint}</p>
            </div>
          ) : (
            <>
              {plan.weeklyGoal && (
                <section className="card-hero p-5">
                  <p className="text-sm text-slate-600 dark:text-slate-300">{tr.weeklyGoal}</p>
                  <p className="mt-1 font-semibold leading-snug">{plan.weeklyGoal}</p>
                </section>
              )}

              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {DAYS.map((day, i) => {
                  const count = plan.weeklyPlan?.[day]?.length ?? 0;
                  return (
                    <button
                      key={day}
                      onClick={() => setPlanDay(i)}
                      aria-pressed={planDay === i}
                      className={`flex shrink-0 flex-col items-center rounded-2xl px-3.5 py-2 text-sm font-medium transition-colors ${
                        planDay === i ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-white/85 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                      }`}
                    >
                      {t.days[i]}
                      <span className="text-[10px] opacity-70">{count === 0 ? "—" : count}</span>
                    </button>
                  );
                })}
              </div>

              {plan.warmup && planDay === todayIndex && (
                <section className="tint-peach rounded-[1.5rem] p-4">
                  <p className="text-sm font-semibold">{tr.warmup}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plan.warmup}</p>
                </section>
              )}

              {(plan.weeklyPlan?.[DAYS[planDay]] ?? []).length === 0 ? (
                <div className="tint-lilac rounded-[1.5rem] p-6 text-center font-semibold">{tr.restDay}</div>
              ) : (
                <div className="space-y-3">
                  {plan.weeklyPlan[DAYS[planDay]].map((ex, j) => {
                    const intensity = normalizeIntensity(ex.intensity);
                    return (
                      <div key={j} className="card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">{ex.exercise}</div>
                            {ex.sets ? <div className="mt-0.5 text-xs text-slate-500">{tr.setsReps(ex.sets, ex.reps ?? "")}</div> : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {intensity && (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INTENSITY_STYLE[intensity]}`}>
                                {tr.intensity[intensity]}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock size={13} /> {ex.duration} {t.common.min}
                            </span>
                          </div>
                        </div>
                        {ex.notes && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{ex.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {plan.tips?.length > 0 && (
                <section className="card p-4">
                  <p className="mb-2 font-semibold">{tr.tips}</p>
                  <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {plan.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {plan.cooldown && (
                <section className="tint-lilac rounded-[1.5rem] p-4">
                  <p className="text-sm font-semibold">{tr.cooldown}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plan.cooldown}</p>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-2 py-3 dark:bg-white/5">
      <div className="flex justify-center">{icon}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="text-[11px] text-slate-600 dark:text-slate-300">{label}</div>
    </div>
  );
}

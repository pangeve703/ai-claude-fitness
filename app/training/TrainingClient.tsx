"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, ChevronDown, ChevronUp, Clock, Info } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

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
  goal: string;
}

const INTENSITY_COLOR: Record<string, string> = {
  低: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  中: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  高: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

interface ParsedNotes {
  rows: { icon: string; text: string }[];
  details: string | null;
  raw: string | null;
}

function parseNotes(notes: string | null | undefined): ParsedNotes {
  if (!notes) return { rows: [], details: null, raw: null };
  try {
    const n = JSON.parse(notes);
    if (!n || typeof n !== "object") throw new Error();
    const rows: { icon: string; text: string }[] = [];
    if (n.distance) rows.push({ icon: "📍", text: String(n.distance) });
    if (n.pace) rows.push({ icon: "⚡️", text: String(n.pace) });
    if (n.heartRate) rows.push({ icon: "❤️", text: String(n.heartRate) });
    if (n.caloriesBurned) rows.push({ icon: "🔥", text: `${n.caloriesBurned} 卡` });
    return { rows, details: typeof n.details === "string" ? n.details : null, raw: null };
  } catch {
    return { rows: [], details: null, raw: notes };
  }
}

export default function TrainingClient({ trainingLogs, plan, today }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"today" | "plan">("today");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const todayDayIndex = new Date().getDay();
  const todayKey = DAYS[todayDayIndex === 0 ? 6 : todayDayIndex - 1];

  const totalMinutes = trainingLogs.reduce((sum: number, l) => sum + l.duration, 0);
  const completedCount = trainingLogs.filter((l) => l.completed).length;
  const totalBurned = trainingLogs.reduce((sum: number, l) => {
    const { rows } = parseNotes(l.notes);
    const cal = rows.find((r) => r.icon === "🔥");
    if (cal) return sum + parseInt(cal.text) || sum;
    return sum + l.duration * 5;
  }, 0);

  async function toggleComplete(id: number, completed: boolean) {
    await fetch("/api/training-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
    router.refresh();
  }

  async function addTodayExercises() {
    if (!plan?.weeklyPlan?.[todayKey]) return;
    const exercises = plan.weeklyPlan[todayKey];
    for (const ex of exercises) {
      await fetch("/api/training-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          exercise: ex.exercise + (ex.sets ? ` ${ex.sets}组×${ex.reps}` : ""),
          duration: ex.duration,
          notes: ex.notes,
        }),
      });
    }
    router.refresh();
  }

  const todayPlanExercises = plan?.weeklyPlan?.[todayKey] || [];
  const isRestDay = todayPlanExercises.length === 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">训练计划</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{completedCount}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">已完成</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{totalMinutes}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">分钟</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-orange-500 dark:text-orange-400">
            {Math.round(totalBurned)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">消耗卡</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "today" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          今日训练
        </button>
        <button
          onClick={() => setActiveTab("plan")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "plan" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          本周计划
        </button>
      </div>

      {activeTab === "today" && (
        <div className="space-y-3">
          {/* Today's plan suggestion */}
          {plan && (
            <div className={`rounded-2xl p-4 ${isRestDay ? "bg-slate-100 dark:bg-slate-800" : "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800"}`}>
              <p className="font-medium text-slate-800 dark:text-slate-100 mb-1">
                {isRestDay ? "🛌 今天是休息日" : `📋 今日计划 (${todayPlanExercises.length} 项运动)`}
              </p>
              {!isRestDay && (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    {todayPlanExercises.map((e) => e.exercise).join(" · ")}
                  </p>
                  {trainingLogs.length === 0 && (
                    <button
                      onClick={addTodayExercises}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      载入今日训练
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {trainingLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
              <p className="text-4xl mb-2">🏋️</p>
              <p>还没有训练记录</p>
              {plan && !isRestDay && (
                <p className="text-sm mt-1">点击上方「载入今日训练」开始</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {trainingLogs.map((log) => {
                const parsed = parseNotes(log.notes);
                const isExpanded = expandedLogId === log.id;
                const hasDetails = !!parsed.details || !!parsed.raw;
                return (
                  <div
                    key={log.id}
                    className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden ${
                      log.completed ? "opacity-70" : ""
                    }`}
                  >
                    <div className="p-4 flex items-start gap-3">
                      <button onClick={() => toggleComplete(log.id, !log.completed)} className="mt-0.5">
                        {log.completed ? (
                          <CheckCircle size={24} className="text-emerald-500" />
                        ) : (
                          <Circle size={24} className="text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <button
                        onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                        className="flex-1 min-w-0 text-left"
                        disabled={!hasDetails}
                      >
                        <div className={`font-medium text-sm ${log.completed ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                          {log.exercise}
                        </div>
                        {parsed.rows.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {parsed.rows.map((r, i) => (
                              <span key={i} className="text-xs text-slate-500 dark:text-slate-400">
                                {r.icon} {r.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-sm">
                          <Clock size={14} />
                          {log.duration}分
                        </div>
                        {hasDetails && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-slate-300 dark:text-slate-600 hover:text-blue-400"
                            aria-label="详情"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                    {isExpanded && hasDetails && (
                      <div className="px-4 pb-4 -mt-1 ml-9 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-3">
                        {parsed.details || parsed.raw}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "plan" && (
        <div className="space-y-3">
          {!plan ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
              <p className="text-4xl mb-2">🤖</p>
              <p>还没有 AI 训练计划</p>
              <p className="text-sm mt-1">返回主页点击「训练计划」生成</p>
            </div>
          ) : (
            <>
              {plan.weeklyGoal && (
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                  <p className="font-medium text-blue-800 dark:text-blue-300">🎯 本周目标</p>
                  <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">{plan.weeklyGoal}</p>
                </div>
              )}

              {plan.warmup && (
                <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4">
                  <p className="font-medium text-yellow-800 dark:text-yellow-300 text-sm">🔥 热身</p>
                  <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">{plan.warmup}</p>
                </div>
              )}

              {DAYS.map((day, i) => {
                const exercises = plan.weeklyPlan?.[day] || [];
                const isToday = day === todayKey;
                const isExpanded = expandedDay === day;
                return (
                  <div
                    key={day}
                    className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden ${isToday ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day)}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {DAY_CN[i]} {isToday && "（今天）"}
                        </span>
                        <span className="ml-2 text-sm text-slate-400 dark:text-slate-500">
                          {exercises.length === 0 ? "休息日" : `${exercises.length} 项运动`}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-400" />
                      )}
                    </button>

                    {isExpanded && exercises.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700/40">
                        {exercises.map((ex, j) => (
                          <div key={j} className="px-4 py-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{ex.exercise}</div>
                                {ex.sets && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {ex.sets} 组 × {ex.reps}
                                  </div>
                                )}
                                {ex.notes && (
                                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{ex.notes}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INTENSITY_COLOR[ex.intensity] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                                  {ex.intensity}
                                </span>
                                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs">
                                  <Clock size={12} />
                                  {ex.duration}分
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {plan.tips && plan.tips.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-2xl p-4">
                  <p className="font-medium text-green-800 dark:text-green-300 mb-2">💡 训练建议</p>
                  {plan.tips.map((tip, i) => (
                    <p key={i} className="text-green-700 dark:text-green-400 text-sm mb-1">• {tip}</p>
                  ))}
                </div>
              )}

              {plan.cooldown && (
                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
                  <p className="font-medium text-purple-800 dark:text-purple-300 text-sm">❄️ 冷身</p>
                  <p className="text-purple-700 dark:text-purple-400 text-sm mt-1">{plan.cooldown}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

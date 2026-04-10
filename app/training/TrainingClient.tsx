"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, ChevronDown, ChevronUp, Clock } from "lucide-react";

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
  低: "bg-green-100 text-green-700",
  中: "bg-yellow-100 text-yellow-700",
  高: "bg-red-100 text-red-700",
};

export default function TrainingClient({ trainingLogs, plan, today }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"today" | "plan">("today");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const todayDayIndex = new Date().getDay();
  const todayKey = DAYS[todayDayIndex === 0 ? 6 : todayDayIndex - 1];

  const totalMinutes = trainingLogs.reduce((sum, l) => sum + l.duration, 0);
  const completedCount = trainingLogs.filter((l) => l.completed).length;

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
      <h1 className="text-xl font-bold text-slate-800">训练计划</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-blue-600">{completedCount}</div>
          <div className="text-xs text-slate-500">已完成</div>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-slate-800">{totalMinutes}</div>
          <div className="text-xs text-slate-500">分钟</div>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-orange-500">
            {Math.round(totalMinutes * 5)}
          </div>
          <div className="text-xs text-slate-500">估计消耗卡</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "today" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"
          }`}
        >
          今日训练
        </button>
        <button
          onClick={() => setActiveTab("plan")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "plan" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"
          }`}
        >
          本周计划
        </button>
      </div>

      {activeTab === "today" && (
        <div className="space-y-3">
          {/* Today's plan suggestion */}
          {plan && (
            <div className={`rounded-2xl p-4 ${isRestDay ? "bg-slate-100" : "bg-blue-50 border border-blue-200"}`}>
              <p className="font-medium text-slate-800 mb-1">
                {isRestDay ? "🛌 今天是休息日" : `📋 今日计划 (${todayPlanExercises.length} 项运动)`}
              </p>
              {!isRestDay && (
                <>
                  <p className="text-sm text-slate-600 mb-2">
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
            <div className="text-center py-10 text-slate-400">
              <p className="text-4xl mb-2">🏋️</p>
              <p>还没有训练记录</p>
              {plan && !isRestDay && (
                <p className="text-sm mt-1">点击上方「载入今日训练」开始</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {trainingLogs.map((log) => (
                <div
                  key={log.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 ${
                    log.completed ? "opacity-70" : ""
                  }`}
                >
                  <button onClick={() => toggleComplete(log.id, !log.completed)}>
                    {log.completed ? (
                      <CheckCircle size={24} className="text-emerald-500" />
                    ) : (
                      <Circle size={24} className="text-slate-300" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className={`font-medium text-sm ${log.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                      {log.exercise}
                    </div>
                    {log.notes && (
                      <div className="text-xs text-slate-400 mt-0.5">{log.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 text-sm">
                    <Clock size={14} />
                    {log.duration}分
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "plan" && (
        <div className="space-y-3">
          {!plan ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-4xl mb-2">🤖</p>
              <p>还没有 AI 训练计划</p>
              <p className="text-sm mt-1">返回主页点击「训练计划」生成</p>
            </div>
          ) : (
            <>
              {plan.weeklyGoal && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="font-medium text-blue-800">🎯 本周目标</p>
                  <p className="text-blue-700 text-sm mt-1">{plan.weeklyGoal}</p>
                </div>
              )}

              {plan.warmup && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                  <p className="font-medium text-yellow-800 text-sm">🔥 热身</p>
                  <p className="text-yellow-700 text-sm mt-1">{plan.warmup}</p>
                </div>
              )}

              {DAYS.map((day, i) => {
                const exercises = plan.weeklyPlan?.[day] || [];
                const isToday = day === todayKey;
                const isExpanded = expandedDay === day;
                return (
                  <div
                    key={day}
                    className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isToday ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day)}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <span className="font-medium text-slate-800">
                          {DAY_CN[i]} {isToday && "（今天）"}
                        </span>
                        <span className="ml-2 text-sm text-slate-400">
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
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {exercises.map((ex, j) => (
                          <div key={j} className="px-4 py-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-slate-800 text-sm">{ex.exercise}</div>
                                {ex.sets && (
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {ex.sets} 组 × {ex.reps}
                                  </div>
                                )}
                                {ex.notes && (
                                  <div className="text-xs text-slate-400 mt-1">{ex.notes}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INTENSITY_COLOR[ex.intensity] || "bg-slate-100 text-slate-600"}`}>
                                  {ex.intensity}
                                </span>
                                <div className="flex items-center gap-1 text-slate-400 text-xs">
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
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="font-medium text-green-800 mb-2">💡 训练建议</p>
                  {plan.tips.map((tip, i) => (
                    <p key={i} className="text-green-700 text-sm mb-1">• {tip}</p>
                  ))}
                </div>
              )}

              {plan.cooldown && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                  <p className="font-medium text-purple-800 text-sm">❄️ 冷身</p>
                  <p className="text-purple-700 text-sm mt-1">{plan.cooldown}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

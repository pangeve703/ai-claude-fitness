"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell, Scale, Bot, ChevronRight, AlertCircle,
  Eye, EyeOff, Pencil, Check, X, Lock, ChevronDown, ChevronUp,
  Utensils, Activity, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";

const GOAL_LABEL: Record<string, string> = {
  lose_fat: "🔥 减脂",
  run_speed: "🏃 提升跑速",
  heart_rate: "❤️ 改善心率",
  build_muscle: "💪 增肌",
};

const MEAL_LABEL: Record<string, string> = {
  breakfast: "☀️ 早餐",
  lunch: "🌤 午餐",
  dinner: "🌙 晚餐",
  snack: "🍎 小食",
};

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"];

interface ChartDay { date: string; consumed: number; burned: number; target: number; }
interface WeightPoint { date: string; weight: number; }
interface FoodLog { calories: number; foodName: string; meal: string; protein: number; carbs: number; fat: number; }
interface MacroTargets { protein: number; carbs: number; fat: number; }

interface Props {
  user: { name: string; weight: number; height: number; goal: string; targetWeight?: number | null; };
  todayCalories: number;
  todayBurned: number;
  targetCalories: number;
  macroTargets: MacroTargets;
  completedWorkouts: number;
  totalWorkouts: number;
  foodLogs: FoodLog[];
  bmi: number;
  hasDietPlan: boolean;
  hasTrainingPlan: boolean;
  dietLockedUntil: string | null;
  trainingLockedUntil: string | null;
  chartData: ChartDay[];
  weightChartData: WeightPoint[];
  targetWeight: number | null;
}

export default function DashboardClient({
  user, todayCalories, todayBurned, targetCalories, completedWorkouts, totalWorkouts,
  macroTargets, foodLogs, bmi, hasDietPlan, hasTrainingPlan, dietLockedUntil, trainingLockedUntil, chartData,
  weightChartData, targetWeight,
}: Props) {
  const router = useRouter();

  const [generatingDiet, setGeneratingDiet] = useState(false);
  const [generatingTraining, setGeneratingTraining] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showWeight, setShowWeight] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState(String(user.weight));
  const [displayWeight, setDisplayWeight] = useState(user.weight);
  const [savingWeight, setSavingWeight] = useState(false);
  const [showLog, setShowLog] = useState(false);

  async function handleSaveWeight() {
    const val = parseFloat(newWeight);
    if (!val || val < 20 || val > 300) return;
    setSavingWeight(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: val }),
      });
      setDisplayWeight(val);
      setEditingWeight(false);
      router.refresh();
    } finally { setSavingWeight(false); }
  }

  async function generatePlan(type: "diet" | "training") {
    setPlanError(null);
    if (type === "diet") setGeneratingDiet(true);
    else setGeneratingTraining(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) { router.push(type === "diet" ? "/diet" : "/training"); router.refresh(); }
      else setPlanError(data.error || "生成失败");
    } catch { setPlanError("网络错误，请重试"); }
    finally { setGeneratingDiet(false); setGeneratingTraining(false); }
  }

  const today = new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
  const bmiCategory = bmi < 18.5 ? "偏瘦" : bmi < 24 ? "正常" : bmi < 28 ? "偏重" : "肥胖";
  const consumed = Math.round(todayCalories);
  const burned = Math.round(todayBurned);
  const net = consumed - burned;
  const remaining = targetCalories - net;
  const calorieProgress = Math.min(Math.max(consumed / targetCalories, 0), 1);
  const isOver = remaining < 0;

  // Group food logs by meal
  const byMeal: Record<string, FoodLog[]> = {};
  for (const log of foodLogs) {
    if (!byMeal[log.meal]) byMeal[log.meal] = [];
    byMeal[log.meal].push(log);
  }

  // Today's macros total
  const macros = foodLogs.reduce(
    (acc, l) => ({ p: acc.p + l.protein, c: acc.c + l.carbs, f: acc.f + l.fat }),
    { p: 0, c: 0, f: 0 }
  );
  const macroGoals = [
    {
      key: "fat",
      label: "脂肪",
      current: Math.round(macros.f),
      target: macroTargets.fat,
      unit: "g",
      color: "#86a7f5",
    },
    {
      key: "protein",
      label: "蛋白质",
      current: Math.round(macros.p),
      target: macroTargets.protein,
      unit: "g",
      color: "#facc15",
    },
    {
      key: "carbs",
      label: "碳水",
      current: Math.round(macros.c),
      target: macroTargets.carbs,
      unit: "g",
      color: "#78d66c",
    },
  ];
  const ringRadius = 58;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringSegmentLength = ringCircumference / macroGoals.length;
  const ringGapLength = 20;
  const ringTrackLength = ringSegmentLength - ringGapLength;
  const ringArcs = macroGoals.map((goal, index) => {
    const progress = Math.min(Math.max(goal.current / Math.max(goal.target, 1), 0), 1);
    const visibleLength = ringTrackLength * progress;
    return {
      ...goal,
      dasharray: `${ringTrackLength} ${ringCircumference - ringTrackLength}`,
      progressDasharray: `${visibleLength} ${ringCircumference - visibleLength}`,
      dashoffset: -(index * ringSegmentLength),
      isVisible: visibleLength > 0.5,
    };
  });

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-emerald-100 text-sm">{today}</p>
        <h1 className="text-2xl font-bold mt-1">你好，{user.name} 👋</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="bg-white/20 rounded-full px-3 py-1 text-sm">{GOAL_LABEL[user.goal]}</span>
          <span className="bg-white/20 rounded-full px-3 py-1 text-sm">BMI {bmi.toFixed(1)} {bmiCategory}</span>
        </div>
      </div>

      {/* Nutrition Goals */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-950/50 dark:text-orange-300">
              <Target size={18} />
            </div>
            <div>
              <span className="block font-semibold text-slate-800 dark:text-slate-100">
                热量目标：{targetCalories.toLocaleString()} 卡
              </span>
              <span className={`mt-0.5 block text-xs ${isOver ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
                {isOver ? `净摄入已超出 ${Math.abs(remaining)} 卡` : `还剩 ${remaining.toLocaleString()} 卡`}
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            今日
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[150px_1fr] items-center gap-4">
          <div className="relative h-[150px] w-[150px]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160" aria-label="今日热量与营养比例">
              {ringArcs.map((arc) => (
                <circle
                  key={`${arc.key}-track`}
                  cx="80"
                  cy="80"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={arc.dasharray}
                  strokeDashoffset={arc.dashoffset}
                  className="text-slate-100 dark:text-slate-700"
                />
              ))}
              {ringArcs.map((arc) => (
                arc.isVisible && (
                  <circle
                    key={arc.key}
                    cx="80"
                    cy="80"
                    r={ringRadius}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={arc.progressDasharray}
                    strokeDashoffset={arc.dashoffset}
                  />
                )
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="text-[10px] leading-none text-slate-500 dark:text-slate-400">已摄入</div>
              <div className="mt-1 text-3xl font-semibold leading-none text-slate-900 dark:text-slate-50">
                {consumed.toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] leading-none text-slate-500 dark:text-slate-400">卡</div>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {macroGoals.map((goal) => {
              const pct = Math.min(Math.max(goal.current / Math.max(goal.target, 1), 0), 1);
              const over = goal.current > goal.target;
              return (
                <div key={goal.key}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: goal.color }} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {goal.label}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, backgroundColor: goal.color }}
                    />
                  </div>
                  <div className={`mt-1 text-xs ${over ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
                    {goal.current}{goal.unit} / {goal.target}{goal.unit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:divide-slate-700 dark:border-slate-700 dark:text-slate-300">
          <div className="flex items-center justify-center gap-1.5 px-3 py-2">
            <Utensils size={13} className="text-orange-500" />
            <span>饮食 +{consumed.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 px-3 py-2">
            <Activity size={13} className="text-blue-500" />
            <span>运动 -{burned.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          净摄入 <span className="font-semibold text-slate-700 dark:text-slate-200">{net.toLocaleString()}</span> 卡 ·
          进度 {Math.round(calorieProgress * 100)}%
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center shadow-sm">
          <Dumbbell size={24} className="mx-auto text-blue-500 mb-1" />
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{completedWorkouts}/{totalWorkouts || "—"}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">训练完成</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Scale size={18} className="text-purple-500" />
            <button onClick={() => setShowWeight(v => !v)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              {showWeight ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {editingWeight ? (
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                className="w-full border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSaveWeight()}
              />
              <button onClick={handleSaveWeight} disabled={savingWeight} className="text-emerald-500 shrink-0"><Check size={16} /></button>
              <button onClick={() => { setEditingWeight(false); setNewWeight(String(displayWeight)); }} className="text-slate-400 shrink-0"><X size={16} /></button>
            </div>
          ) : (
            <div className="flex items-end justify-between mt-1">
              <div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{showWeight ? displayWeight : "••••"}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">目前体重</div>
              </div>
              <button onClick={() => setEditingWeight(true)} className="text-slate-300 dark:text-slate-600 hover:text-purple-400 mb-0.5"><Pencil size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Today's Food Log */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowLog(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-100">今日饮食记录</span>
            {foodLogs.length > 0 && (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                {foodLogs.length} 条
              </span>
            )}
          </div>
          {showLog ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showLog && (
          <div className="px-4 pb-4 space-y-3">
            {foodLogs.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
                还没有记录，发送食物照片到 Telegram 开始追踪
              </p>
            ) : (
              MEAL_ORDER.filter(m => byMeal[m]).map(meal => (
                <div key={meal}>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{MEAL_LABEL[meal] || meal}</div>
                  <div className="space-y-1">
                    {byMeal[meal].map((log, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                        <span className="text-sm text-slate-700 dark:text-slate-200">{log.foodName}</span>
                        <span className="text-sm font-medium text-orange-500">{Math.round(log.calories)} 卡</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 7-Day Calorie Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">近 7 天热量</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} barSize={14} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
              formatter={(v, name) => [`${v ?? 0} 卡`, name === "consumed" ? "摄入" : "运动消耗"]}
            />
            <Legend iconType="circle" iconSize={8} formatter={v => v === "consumed" ? "摄入" : "运动消耗"} wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={targetCalories} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "目标", position: "right", fontSize: 10, fill: "#10b981" }} />
            <Bar dataKey="consumed" fill="#fb923c" radius={[4, 4, 0, 0]} />
            <Bar dataKey="burned" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weight History Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">近 30 天体重</h3>
          {weightChartData.length >= 2 && (() => {
            const first = weightChartData[0].weight;
            const last = weightChartData[weightChartData.length - 1].weight;
            const diff = last - first;
            const pos = diff > 0;
            return (
              <span className={`text-xs font-medium ${diff === 0 ? "text-slate-400" : pos ? "text-red-500" : "text-emerald-500"}`}>
                {diff === 0 ? "持平" : `${pos ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)} kg`}
              </span>
            );
          })()}
        </div>
        {weightChartData.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
            还没有体重记录<br />
            <span className="text-xs">编辑上方体重即可开始追踪</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weightChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                formatter={(v) => [`${v} kg`, "体重"]}
              />
              {targetWeight != null && (
                <ReferenceLine y={targetWeight} stroke="#a855f7" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: `目标 ${targetWeight}`, position: "right", fontSize: 10, fill: "#a855f7" }} />
              )}
              <Line type="monotone" dataKey="weight" stroke="#a855f7" strokeWidth={2} dot={{ r: 3, fill: "#a855f7" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Plan Error */}
      {planError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300 text-sm">生成计划失败</p>
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{planError}</p>
          </div>
        </div>
      )}

      {/* AI Plans */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 px-1">AI 个人计划</h3>

        {[
          { type: "diet" as const, emoji: "🥗", label: "饮食计划", bg: "bg-orange-100 dark:bg-orange-900", locked: dietLockedUntil, hasplan: hasDietPlan, generating: generatingDiet, spinner: "border-emerald-400" },
          { type: "training" as const, emoji: "💪", label: "训练计划", bg: "bg-blue-100 dark:bg-blue-900", locked: trainingLockedUntil, hasplan: hasTrainingPlan, generating: generatingTraining, spinner: "border-blue-400" },
        ].map(({ type, emoji, label, bg, locked, hasplan, generating, spinner }) => (
          <button
            key={type}
            onClick={() => {
              if (locked) return;
              if (hasplan) {
                router.push(`/${type === "diet" ? "diet" : "training"}`);
              } else {
                generatePlan(type);
              }
            }}
            disabled={generating || !!locked}
            className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center text-xl`}>{emoji}</div>
              <div className="text-left">
                <div className="font-medium text-slate-800 dark:text-slate-100">{label}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {generating ? "AI 正在生成，请稍候..." : locked ? `本周已生成，${locked} 后可更新` : hasplan ? "查看本周计划" : "点击生成个人计划"}
                </div>
              </div>
            </div>
            {generating ? <div className={`w-5 h-5 border-2 ${spinner} border-t-transparent rounded-full animate-spin`} />
              : locked ? <Lock size={16} className="text-slate-300 dark:text-slate-600" />
              : <ChevronRight size={18} className="text-slate-400" />}
          </button>
        ))}
      </div>

      {/* Telegram */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3">
          <Bot size={28} />
          <div className="flex-1">
            <div className="font-semibold">Telegram 记录</div>
            <div className="text-blue-100 text-sm">食物拍照 · 运动截图 · 文字描述</div>
          </div>
          <span className="bg-blue-400 px-3 py-1.5 rounded-lg text-sm">🟢 运行中</span>
        </div>
        <p className="text-blue-100 text-xs mt-2">发送 /quick 快速记录常用食物</p>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";

const MEAL_LABEL: Record<string, string> = {
  breakfast: "☀️ 早餐",
  lunch: "🌤 午餐",
  dinner: "🌙 晚餐",
  snack: "🍎 小食",
};

interface FoodLog {
  id: number;
  meal: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
}

interface DietPlan {
  dailyCalories: number;
  macros: { protein: number; carbs: number; fat: number };
  weeklyPlan: Record<string, Record<string, { name: string; calories: number; description: string }>>;
  tips: string[];
  forbidden: string[];
}

interface Props {
  foodLogs: FoodLog[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  plan: DietPlan | null;
  today: string;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export default function DietClient({ foodLogs, totals, plan, today }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"log" | "plan">("log");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<FoodLog | null>(null);
  const [editForm, setEditForm] = useState({
    meal: "breakfast",
    foodName: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingFood, setDeletingFood] = useState(false);
  const [addingFood, setAddingFood] = useState(false);
  const [addForm, setAddForm] = useState({
    meal: "breakfast",
    foodName: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  const todayDayIndex = new Date().getDay();
  const todayKey = DAYS[todayDayIndex === 0 ? 6 : todayDayIndex - 1];

  async function addFood() {
    if (!addForm.foodName || !addForm.calories) return;
    setAddingFood(true);
    try {
      const res = await fetch("/api/food-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          calories: parseFloat(addForm.calories),
          protein: parseFloat(addForm.protein) || 0,
          carbs: parseFloat(addForm.carbs) || 0,
          fat: parseFloat(addForm.fat) || 0,
          date: today,
        }),
      });
      if (!res.ok) throw new Error("Failed to add food");
      setAddForm({ meal: "breakfast", foodName: "", calories: "", protein: "", carbs: "", fat: "" });
      setShowAddForm(false);
      router.refresh();
    } catch (err) {
      console.error("Add food error:", err);
      alert("添加食物失败，请重试");
    } finally {
      setAddingFood(false);
    }
  }

  function startEdit(log: FoodLog) {
    setDeletingLog(null);
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
      const res = await fetch("/api/food-log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLog.id,
          meal: editForm.meal,
          foodName: editForm.foodName,
          calories: parseFloat(editForm.calories),
          protein: parseFloat(editForm.protein) || 0,
          carbs: parseFloat(editForm.carbs) || 0,
          fat: parseFloat(editForm.fat) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingLog(null);
      router.refresh();
    } catch {
      alert("更新失败，请重试");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDeleteFood() {
    if (!deletingLog) return;
    setDeletingFood(true);
    try {
      const res = await fetch(`/api/food-log?id=${deletingLog.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDeletingLog(null);
      router.refresh();
    } catch {
      alert("删除失败，请重试");
    } finally {
      setDeletingFood(false);
    }
  }

  const targetCal = plan?.dailyCalories || 2000;
  const calPct = Math.min((totals.calories / targetCal) * 100, 100);

  const byMeal: Record<string, FoodLog[]> = {};
  for (const log of foodLogs) {
    if (!byMeal[log.meal]) byMeal[log.meal] = [];
    byMeal[log.meal].push(log);
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">饮食管理</h1>

      {/* Calorie Progress */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">今日卡路里</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {Math.round(totals.calories)} / {targetCal} 卡
          </span>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              calPct > 100 ? "bg-red-400" : "bg-emerald-400"
            }`}
            style={{ width: `${calPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "蛋白质", val: totals.protein, target: plan?.macros.protein, color: "text-blue-500" },
            { label: "碳水", val: totals.carbs, target: plan?.macros.carbs, color: "text-yellow-500" },
            { label: "脂肪", val: totals.fat, target: plan?.macros.fat, color: "text-orange-500" },
          ].map(({ label, val, target, color }) => (
            <div key={label} className="text-center">
              <div className={`font-bold ${color}`}>{Math.round(val)}g</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{label}{target ? ` / ${target}g` : ""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("log")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "log" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          今日记录
        </button>
        <button
          onClick={() => setActiveTab("plan")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "plan" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          AI 饮食计划
        </button>
      </div>

      {activeTab === "log" && (
        <div className="space-y-3">
          <button
            onClick={() => {
              setEditingLog(null);
              setDeletingLog(null);
              setShowAddForm(true);
            }}
            className="w-full bg-emerald-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
          >
            <Plus size={18} /> 手动添加食物
          </button>

          {foodLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
              <p className="text-4xl mb-2">🍽</p>
              <p>还没有饮食记录</p>
              <p className="text-sm mt-1">手动添加或通过 Telegram 发送照片</p>
            </div>
          ) : (
            Object.entries(MEAL_LABEL).map(([meal, label]) => {
              const items = byMeal[meal] || [];
              if (items.length === 0) return null;
              return (
                <div key={meal} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200">
                    {label}
                  </div>
                  {items.map((log) => (
                    <div key={log.id} className="flex items-center px-4 py-3 border-b border-slate-50 dark:border-slate-700/40 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-800 dark:text-slate-100 font-medium text-sm">{log.foodName}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {Math.round(log.calories)}卡 · P:{Math.round(log.protein)}g · C:{Math.round(log.carbs)}g · F:{Math.round(log.fat)}g
                          {log.source === "telegram" && " · 📸"}
                        </div>
                      </div>
                      <button
                        onClick={() => startEdit(log)}
                        className="text-slate-300 dark:text-slate-600 hover:text-blue-400 transition-colors p-1"
                        aria-label={`编辑 ${log.foodName}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingLog(null);
                          setDeletingLog(log);
                        }}
                        className="text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors p-1"
                        aria-label={`删除 ${log.foodName}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {showAddForm && (
        <div className="cute-popup-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="cute-popup-panel w-full max-w-md rounded-2xl bg-white p-4 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-50">手动添加食物</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">记录餐别、热量和三大营养素</p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="cute-tap rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="关闭添加面板"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <select
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200"
                value={addForm.meal}
                onChange={(e) => setAddForm((p) => ({ ...p, meal: e.target.value }))}
              >
                {Object.entries(MEAL_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5"
                placeholder="食物名称"
                value={addForm.foodName}
                onChange={(e) => setAddForm((p) => ({ ...p, foodName: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="卡路里" value={addForm.calories} onChange={(e) => setAddForm((p) => ({ ...p, calories: e.target.value }))} />
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="蛋白质(g)" value={addForm.protein} onChange={(e) => setAddForm((p) => ({ ...p, protein: e.target.value }))} />
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="碳水(g)" value={addForm.carbs} onChange={(e) => setAddForm((p) => ({ ...p, carbs: e.target.value }))} />
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="脂肪(g)" value={addForm.fat} onChange={(e) => setAddForm((p) => ({ ...p, fat: e.target.value }))} />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={addFood}
                disabled={addingFood || !addForm.foodName || !addForm.calories}
                className="cute-tap flex-1 bg-emerald-500 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm shadow-emerald-200/70 disabled:opacity-60 dark:shadow-none"
              >
                <Plus size={16} /> {addingFood ? "添加中..." : "添加"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                disabled={addingFood}
                className="cute-tap flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-xl font-medium disabled:opacity-60"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLog && (
        <div className="cute-popup-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="cute-popup-panel w-full max-w-md rounded-2xl bg-white p-4 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-50">编辑饮食记录</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">调整餐别、份量和营养数据</p>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="cute-tap rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="关闭编辑面板"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <select
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200"
                value={editForm.meal}
                onChange={(e) => setEditForm((p) => ({ ...p, meal: e.target.value }))}
              >
                {Object.entries(MEAL_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5"
                placeholder="食物名称"
                value={editForm.foodName}
                onChange={(e) => setEditForm((p) => ({ ...p, foodName: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="卡路里" value={editForm.calories} onChange={(e) => setEditForm((p) => ({ ...p, calories: e.target.value }))} />
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="蛋白质(g)" value={editForm.protein} onChange={(e) => setEditForm((p) => ({ ...p, protein: e.target.value }))} />
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="碳水(g)" value={editForm.carbs} onChange={(e) => setEditForm((p) => ({ ...p, carbs: e.target.value }))} />
                <input type="number" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5" placeholder="脂肪(g)" value={editForm.fat} onChange={(e) => setEditForm((p) => ({ ...p, fat: e.target.value }))} />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveEdit}
                disabled={savingEdit || !editForm.foodName || !editForm.calories}
                className="cute-tap flex-1 bg-emerald-500 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm shadow-emerald-200/70 disabled:opacity-60 dark:shadow-none"
              >
                <Check size={16} /> {savingEdit ? "保存中..." : "保存"}
              </button>
              <button
                onClick={() => setEditingLog(null)}
                className="cute-tap flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-xl font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingLog && (
        <div className="cute-popup-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="cute-popup-panel w-full max-w-md rounded-2xl bg-white p-4 dark:bg-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/50">
              <Trash2 size={20} />
            </div>
            <h2 className="mt-3 font-semibold text-slate-900 dark:text-slate-50">删除这条记录？</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {deletingLog.foodName}，{Math.round(deletingLog.calories)} 卡。删除后今日统计会立即更新。
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmDeleteFood}
                disabled={deletingFood}
                className="cute-tap flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium shadow-sm shadow-red-200/70 disabled:opacity-60 dark:shadow-none"
              >
                {deletingFood ? "删除中..." : "确认删除"}
              </button>
              <button
                onClick={() => setDeletingLog(null)}
                disabled={deletingFood}
                className="cute-tap flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-xl font-medium disabled:opacity-60"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "plan" && (
        <div className="space-y-3">
          {!plan ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
              <p className="text-4xl mb-2">🤖</p>
              <p>还没有 AI 饮食计划</p>
              <p className="text-sm mt-1">返回主页点击「饮食计划」生成</p>
            </div>
          ) : (
            <>
              {/* Macros target */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
                <p className="font-medium text-emerald-800 dark:text-emerald-300 mb-1">每日目标</p>
                <p className="text-emerald-700 dark:text-emerald-400 text-sm">
                  {plan.dailyCalories} 卡 ·
                  蛋白质 {plan.macros.protein}g ·
                  碳水 {plan.macros.carbs}g ·
                  脂肪 {plan.macros.fat}g
                </p>
              </div>

              {/* Weekly plan */}
              {DAYS.map((day, i) => {
                const meals = plan.weeklyPlan?.[day];
                const isToday = day === todayKey;
                const isExpanded = expandedDay === day;
                if (!meals) return null;
                return (
                  <div key={day} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden ${isToday ? "ring-2 ring-emerald-400" : ""}`}>
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day)}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {DAY_CN[i]} {isToday && "（今天）"}
                      </span>
                      {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700/40">
                        {Object.entries(meals).map(([mealKey, meal]) => (
                          <div key={mealKey} className="px-4 py-3">
                            <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                              {MEAL_LABEL[mealKey] || mealKey}
                            </div>
                            <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{meal.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meal.description} · {meal.calories}卡</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Tips */}
              {plan.tips && plan.tips.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                  <p className="font-medium text-blue-800 dark:text-blue-300 mb-2">💡 饮食建议</p>
                  {plan.tips.map((tip, i) => (
                    <p key={i} className="text-blue-700 dark:text-blue-400 text-sm mb-1">• {tip}</p>
                  ))}
                </div>
              )}

              {plan.forbidden && plan.forbidden.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-4">
                  <p className="font-medium text-red-800 dark:text-red-300 mb-2">⚠️ 应避免的食物</p>
                  {plan.forbidden.map((f, i) => (
                    <p key={i} className="text-red-700 dark:text-red-400 text-sm mb-1">• {f}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

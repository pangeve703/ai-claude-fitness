"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Target, Activity, Trash2, Save, AlertTriangle } from "lucide-react";

const GOALS = [
  { value: "lose_fat", label: "🔥 减脂" },
  { value: "run_speed", label: "🏃 提升跑速" },
  { value: "heart_rate", label: "❤️ 改善心率" },
  { value: "build_muscle", label: "💪 增肌" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "久坐", desc: "几乎不运动" },
  { value: "light", label: "轻度", desc: "每周 1-3 天" },
  { value: "moderate", label: "中度", desc: "每周 3-5 天" },
  { value: "active", label: "高度", desc: "每周 6-7 天" },
  { value: "very_active", label: "极度", desc: "每天高强度" },
];

interface UserData {
  name: string;
  gender: string;
  age: number;
  height: number;
  weight: number;
  targetWeight?: number | null;
  activityLevel: string;
  goal: string;
}

export default function ProfileClient({ user }: { user: UserData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: user.name,
    gender: user.gender,
    age: String(user.age),
    height: String(user.height),
    weight: String(user.weight),
    targetWeight: user.targetWeight ? String(user.targetWeight) : "",
    activityLevel: user.activityLevel,
    goal: user.goal,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || "用户",
          gender: form.gender,
          age: parseInt(form.age),
          height: parseFloat(form.height),
          weight: parseFloat(form.weight),
          targetWeight: form.targetWeight ? parseFloat(form.targetWeight) : null,
          activityLevel: form.activityLevel,
          goal: form.goal,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await fetch("/api/reset", { method: "DELETE" });
      setShowResetConfirm(false);
      router.push("/dashboard");
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <User size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{user.name}</h1>
            <p className="text-emerald-100 text-sm">个人资料</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User size={18} className="text-emerald-600" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">基本资料</h2>
        </div>

        <div>
          <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">名字</label>
          <input
            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 dark:text-slate-100"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block">性别</label>
          <div className="flex gap-3">
            {["female", "male"].map((g) => (
              <button
                key={g}
                onClick={() => update("gender", g)}
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                  form.gender === g
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {g === "female" ? "女 👩" : "男 👨"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "age", label: "年龄", unit: "岁" },
            { key: "height", label: "身高", unit: "cm" },
            { key: "weight", label: "体重", unit: "kg" },
          ].map(({ key, label, unit }) => (
            <div key={key}>
              <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">{label}</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 dark:text-slate-100 pr-8"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => update(key, e.target.value)}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Target size={18} className="text-emerald-600" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">健身目标</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((goal) => (
            <button
              key={goal.value}
              onClick={() => update("goal", goal.value)}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                form.goal === goal.value
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {goal.label}
            </button>
          ))}
        </div>
        {(form.goal === "lose_fat" || form.goal === "build_muscle") && (
          <div>
            <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">目标体重 (kg)</label>
            <input
              type="number"
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 dark:text-slate-100"
              placeholder="例：55"
              value={form.targetWeight}
              onChange={(e) => update("targetWeight", e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Activity Level */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} className="text-emerald-600" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">活动水平</h2>
        </div>
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => update("activityLevel", level.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                form.activityLevel === level.value
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="font-medium text-slate-800">{level.label}</span>
              <span className="text-sm text-slate-500">{level.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-60 transition-colors"
      >
        <Save size={18} />
        {saving ? "保存中..." : saved ? "✓ 已保存！" : "保存修改"}
      </button>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-red-100 dark:border-red-900">
        <h2 className="font-semibold text-slate-800 mb-1">数据管理</h2>
        <p className="text-sm text-slate-500 mb-4">
          重置将清除所有饮食记录、训练记录和 AI 计划，个人资料保留。
        </p>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full border-2 border-red-200 text-red-600 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
            重置所有数据
          </button>
        ) : (
          <div className="bg-red-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={18} />
              <span className="font-medium text-sm">确定要重置所有数据吗？此操作无法撤销。</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {resetting ? "重置中..." : "确认重置"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="h-2" />
    </div>
  );
}

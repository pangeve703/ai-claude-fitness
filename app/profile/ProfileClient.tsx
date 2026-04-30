"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Target, Activity, Trash2, Save, AlertTriangle, Pencil, X } from "lucide-react";

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
  const getInitialForm = () => ({
    name: user.name,
    gender: user.gender,
    age: String(user.age),
    height: String(user.height),
    weight: String(user.weight),
    targetWeight: user.targetWeight ? String(user.targetWeight) : "",
    activityLevel: user.activityLevel,
    goal: user.goal,
  });
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
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function closeEditProfile() {
    if (saving) return;
    setForm(getInitialForm());
    setSaved(false);
    setShowEditProfile(false);
  }

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
        setShowEditProfile(false);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  const currentGoal = GOALS.find((goal) => goal.value === user.goal)?.label || user.goal;
  const currentActivity = ACTIVITY_LEVELS.find((level) => level.value === user.activityLevel);

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
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{user.name}</h1>
            <p className="text-emerald-100 text-sm">个人资料</p>
          </div>
          <button
            onClick={() => {
              setForm(getInitialForm());
              setShowEditProfile(true);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            aria-label="编辑个人资料"
          >
            <Pencil size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "年龄", value: `${user.age}岁` },
          { label: "身高", value: `${user.height}cm` },
          { label: "体重", value: `${user.weight}kg` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-slate-800">
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-emerald-600" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">目标与活动</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
            <div className="text-xs text-slate-500 dark:text-slate-400">健身目标</div>
            <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">{currentGoal}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
            <div className="text-xs text-slate-500 dark:text-slate-400">活动水平</div>
            <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {currentActivity ? `${currentActivity.label} · ${currentActivity.desc}` : user.activityLevel}
            </div>
          </div>
          {user.targetWeight && (
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">目标体重</div>
              <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">{user.targetWeight}kg</div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          setForm(getInitialForm());
          setShowEditProfile(true);
        }}
        className="cute-tap w-full bg-emerald-500 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-200/70 dark:shadow-none"
      >
        <Pencil size={18} />
        编辑个人资料
      </button>

      {showEditProfile && (
        <div className="cute-popup-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="cute-popup-panel max-h-[88vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-50">编辑个人资料</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">更新基本资料、目标和活动水平</p>
              </div>
              <button
                onClick={closeEditProfile}
                className="cute-tap rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="关闭个人资料编辑"
              >
                <X size={18} />
              </button>
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
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
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
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
              }`}
            >
              <span className="font-medium text-slate-800 dark:text-slate-100">{level.label}</span>
              <span className="text-sm text-slate-500">{level.desc}</span>
            </button>
          ))}
        </div>
      </div>

            {/* Save Button */}
            <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="cute-tap flex-1 bg-emerald-500 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-60 transition-colors shadow-sm shadow-emerald-200/70 dark:shadow-none"
        >
          <Save size={18} />
          {saving ? "保存中..." : saved ? "✓ 已保存！" : "保存修改"}
        </button>
        <button
          onClick={closeEditProfile}
          disabled={saving}
          className="cute-tap flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-3.5 rounded-xl font-medium disabled:opacity-60"
        >
          取消
        </button>
            </div>
          </div>
        </div>
      )}

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

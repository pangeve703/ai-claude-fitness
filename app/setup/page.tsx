"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, User, Target, Activity } from "lucide-react";

const GOALS = [
  { value: "lose_fat", label: "🔥 减脂", desc: "燃脂塑形，健康减重" },
  { value: "run_speed", label: "🏃 提升跑速", desc: "改善配速与耐力" },
  { value: "heart_rate", label: "❤️ 改善心率", desc: "强化心肺功能" },
  { value: "build_muscle", label: "💪 增肌", desc: "增加肌肉量与力量" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "久坐", desc: "几乎不运动" },
  { value: "light", label: "轻度", desc: "每周 1-3 天运动" },
  { value: "moderate", label: "中度", desc: "每周 3-5 天运动" },
  { value: "active", label: "高度", desc: "每周 6-7 天运动" },
  { value: "very_active", label: "极度", desc: "每天高强度运动" },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    gender: "female",
    age: "",
    height: "",
    weight: "",
    targetWeight: "",
    activityLevel: "moderate",
    goal: "lose_fat",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch("/api/profile", {
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
      // Start telegram bot
      await fetch("/api/bot-start", { method: "POST" });
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
          <h1 className="text-2xl font-bold">AI 健身教练</h1>
          <p className="text-emerald-100 text-sm mt-1">设置你的个人资料</p>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  s <= step ? "bg-white" : "bg-emerald-400"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <User size={20} className="text-emerald-600" />
                <h2 className="font-semibold text-slate-800">基本资料</h2>
              </div>

              <div>
                <label className="text-sm text-slate-600 mb-1 block">名字</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="你的名字"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-600 mb-2 block">性别</label>
                <div className="flex gap-3">
                  {["female", "male"].map((g) => (
                    <button
                      key={g}
                      onClick={() => update("gender", g)}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${
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
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">年龄</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="岁"
                    value={form.age}
                    onChange={(e) => update("age", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">身高</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="cm"
                    value={form.height}
                    onChange={(e) => update("height", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">体重</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="kg"
                    value={form.weight}
                    onChange={(e) => update("weight", e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!form.age || !form.height || !form.weight}
                className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                下一步 <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Target size={20} className="text-emerald-600" />
                <h2 className="font-semibold text-slate-800">设定目标</h2>
              </div>

              <div className="space-y-3">
                {GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => update("goal", goal.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      form.goal === goal.value
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-medium text-slate-800">{goal.label}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{goal.desc}</div>
                  </button>
                ))}
              </div>

              {(form.goal === "lose_fat" || form.goal === "build_muscle") && (
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">
                    目标体重 (kg)
                  </label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="例：55"
                    value={form.targetWeight}
                    onChange={(e) => update("targetWeight", e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-slate-200 text-slate-600 py-3.5 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-emerald-500 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
                >
                  下一步 <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-emerald-600" />
                <h2 className="font-semibold text-slate-800">活动水平</h2>
              </div>

              <div className="space-y-3">
                {ACTIVITY_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => update("activityLevel", level.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      form.activityLevel === level.value
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-medium text-slate-800">{level.label}</div>
                    <div className="text-sm text-slate-500">{level.desc}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 border border-slate-200 text-slate-600 py-3.5 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-emerald-500 text-white py-3.5 rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? "设置中..." : "🚀 开始使用"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

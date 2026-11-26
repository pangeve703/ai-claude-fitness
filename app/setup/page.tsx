"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, User, Target, Activity } from "lucide-react";
import ApiKeyCard from "@/components/ApiKeyCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

const GOALS = ["lose_fat", "run_speed", "heart_rate", "build_muscle"] as const;
const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;

export default function SetupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const st = t.setup;
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
      // Save profile
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || st.defaultName,
          gender: form.gender,
          age: parseInt(form.age),
          height: parseFloat(form.height),
          weight: parseFloat(form.weight),
          targetWeight: form.targetWeight ? parseFloat(form.targetWeight) : null,
          activityLevel: form.activityLevel,
          goal: form.goal,
        }),
      });

      if (!profileRes.ok) {
        throw new Error(`Profile save failed: ${profileRes.statusText}`);
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Setup error:", err);
      alert(st.failed(err instanceof Error ? err.message : st.unknownError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md overflow-hidden !rounded-[2rem]">
        {/* Header */}
        <div className="card-hero !rounded-none p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{st.title}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{st.subtitle}</p>
            </div>
            <div>
              <LanguageSwitcher />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  s <= step ? "bg-ink dark:bg-white" : "bg-white/70 dark:bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <User size={20} className="text-leaf" />
                <h2 className="font-semibold">{st.basicInfo}</h2>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">{st.name}</label>
                <input
                  className="field"
                  placeholder={st.namePlaceholder}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">{st.gender}</label>
                <div className="flex gap-3">
                  {["female", "male"].map((g) => (
                    <button
                      key={g}
                      onClick={() => update("gender", g)}
                      className={`flex-1 rounded-full py-3 font-medium transition-colors ${
                        form.gender === g
                          ? "bg-ink text-white dark:bg-white dark:text-ink"
                          : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                      }`}
                    >
                      {g === "female" ? t.gender.female : t.gender.male}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">{st.age}</label>
                  <input
                    type="number"
                    className="field"
                    placeholder={st.ageUnit}
                    value={form.age}
                    onChange={(e) => update("age", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">{st.height}</label>
                  <input
                    type="number"
                    className="field"
                    placeholder="cm"
                    value={form.height}
                    onChange={(e) => update("height", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">{st.weight}</label>
                  <input
                    type="number"
                    className="field"
                    placeholder="kg"
                    value={form.weight}
                    onChange={(e) => update("weight", e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!form.age || !form.height || !form.weight}
                className="btn-ink mt-2 flex w-full items-center justify-center gap-2 py-3.5"
              >
                {st.next} <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Target size={20} className="text-leaf" />
                <h2 className="font-semibold">{st.setGoal}</h2>
              </div>

              <div className="space-y-3">
                {GOALS.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => update("goal", goal)}
                    className={`w-full rounded-2xl p-4 text-left transition-colors ${
                      form.goal === goal
                        ? "bg-ink text-white dark:bg-white dark:text-ink"
                        : "bg-slate-100 dark:bg-white/5"
                    }`}
                  >
                    <div className="font-medium">{t.goals[goal].label}</div>
                    <div className="mt-0.5 text-sm opacity-70">{t.goals[goal].desc}</div>
                  </button>
                ))}
              </div>

              {(form.goal === "lose_fat" || form.goal === "build_muscle") && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    {st.targetWeight}
                  </label>
                  <input
                    type="number"
                    className="field"
                    placeholder={st.targetWeightPlaceholder}
                    value={form.targetWeight}
                    onChange={(e) => update("targetWeight", e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="btn-soft flex-1 py-3.5"
                >
                  {st.back}
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn-ink flex flex-1 items-center justify-center gap-2 py-3.5"
                >
                  {st.next} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-leaf" />
                <h2 className="font-semibold">{st.activityLevel}</h2>
              </div>

              <div className="space-y-3">
                {ACTIVITY_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => update("activityLevel", level)}
                    className={`w-full rounded-2xl p-4 text-left transition-colors ${
                      form.activityLevel === level
                        ? "bg-ink text-white dark:bg-white dark:text-ink"
                        : "bg-slate-100 dark:bg-white/5"
                    }`}
                  >
                    <div className="font-medium">{t.activity[level].label}</div>
                    <div className="text-sm opacity-70">{t.activity[level].desc}</div>
                  </button>
                ))}
              </div>

              <ApiKeyCard />

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(2)}
                  className="btn-soft flex-1 py-3.5"
                >
                  {st.back}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-ink flex-1 py-3.5"
                >
                  {loading ? st.submitting : st.start}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

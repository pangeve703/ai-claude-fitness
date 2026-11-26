"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ApiKeyCard from "@/components/ApiKeyCard";
import Sheet from "@/components/Sheet";
import TelegramBotCard from "@/components/TelegramBotCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { useI18n } from "@/components/I18nProvider";
import { Activity, AlertTriangle, Loader2, Palette, Pencil, Save, ShieldCheck, Target, Trash2, User } from "lucide-react";

const GOALS = ["lose_fat", "run_speed", "heart_rate", "build_muscle"] as const;
const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;

interface UserData {
  name: string;
  gender: string;
  age: number;
  height: number;
  weight: number;
  targetWeight?: number | null;
  activityLevel: string;
  goal: string;
  isGuest: boolean;
}

export default function ProfileClient({ user, guestTtlDays }: { user: UserData; guestTtlDays: number }) {
  const router = useRouter();
  const { t } = useI18n();
  const pr = t.profile;
  const st = t.setup;
  const initialForm = () => ({
    name: user.name,
    gender: user.gender,
    age: String(user.age),
    height: String(user.height),
    weight: String(user.weight),
    targetWeight: user.targetWeight ? String(user.targetWeight) : "",
    activityLevel: user.activityLevel,
    goal: user.goal,
  });
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const openEditor = () => {
    setForm(initialForm());
    setEditing(true);
  };

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
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
      if (res.ok) {
        setEditing(false);
        router.refresh();
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

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (res.ok) {
        router.push("/setup");
        router.refresh();
      }
    } finally {
      setDeletingAccount(false);
    }
  }

  const goal = (t.goals as Record<string, { label: string }>)[user.goal]?.label || user.goal;
  const activity = (t.activity as Record<string, { label: string; desc: string }>)[user.activityLevel];

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pt-5">
      {/* Header */}
      <section className="card-hero p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/80 text-xl font-bold dark:bg-white/10">
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{user.name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">{goal}</p>
          </div>
          <button onClick={openEditor} className="btn-ink flex shrink-0 items-center gap-1.5 px-4 py-2 text-sm">
            <Pencil size={14} /> {pr.edit}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: st.age, value: pr.ageValue(user.age) },
            { label: st.height, value: `${user.height} cm` },
            { label: st.weight, value: `${user.weight} kg` },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/70 py-3 text-center dark:bg-white/5">
              <div className="font-bold">{item.value}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <Row icon={<Target size={16} className="text-leaf" />} label={pr.fitnessGoal} value={goal} />
        <Row
          icon={<Activity size={16} className="text-sky" />}
          label={pr.activityLevel}
          value={activity ? `${activity.label} · ${activity.desc}` : user.activityLevel}
        />
        {user.targetWeight ? <Row icon={<User size={16} className="text-[#8b7cf6]" />} label={pr.targetWeight} value={`${user.targetWeight} kg`} /> : null}
      </section>

      {user.isGuest && (
        <section className="tint-mint flex items-start gap-3 rounded-[1.5rem] p-4">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-leaf" />
          <div>
            <p className="text-sm font-semibold">{pr.guestTitle}</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{pr.guestDesc(guestTtlDays)}</p>
          </div>
        </section>
      )}

      {/* Appearance */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-lilac text-[#6d5ce8] dark:bg-lilac/20">
            <Palette size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{pr.appearance}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.language.desc}</p>
          </div>
        </div>
        <LanguageSwitcher variant="segmented" />
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2 dark:bg-white/5">
          <span className="text-sm font-medium">{pr.darkMode}</span>
          <ThemeToggle />
        </div>
      </section>

      <ApiKeyCard />

      <TelegramBotCard />

      {/* Data */}
      <section className="card p-4">
        <h2 className="font-semibold">{pr.dataManagement}</h2>
        <p className="mb-3 mt-0.5 text-sm text-slate-500 dark:text-slate-400">{pr.resetDesc}</p>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
          >
            <Trash2 size={16} /> {pr.resetAll}
          </button>
        ) : (
          <div className="space-y-3 rounded-2xl bg-red-50 p-3 dark:bg-red-950/30">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <AlertTriangle size={16} /> {pr.resetConfirm}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowResetConfirm(false)} className="btn-soft flex-1 py-2.5 text-sm">
                {t.common.cancel}
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {resetting ? pr.resetting : pr.confirmReset}
              </button>
            </div>
          </div>
        )}

        {user.isGuest && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
            <h3 className="text-sm font-semibold">{pr.deleteAccount}</h3>
            <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{pr.deleteAccountDesc}</p>
            {!confirmDeleteAccount ? (
              <button
                onClick={() => setConfirmDeleteAccount(true)}
                className="w-full rounded-full border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
              >
                {pr.deleteAccount}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteAccount(false)} disabled={deletingAccount} className="btn-soft flex-1 py-2.5 text-sm">
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {deletingAccount ? pr.deletingAccount : pr.confirmDeleteAccount}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {editing && (
        <Sheet
          title={pr.editProfile}
          subtitle={pr.editSubtitle}
          onClose={() => !saving && setEditing(false)}
          busy={saving}
          footer={
            <button onClick={handleSave} disabled={saving} className="btn-ink flex flex-1 items-center justify-center gap-2 py-3">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t.common.saving : pr.saveChanges}
            </button>
          }
        >
          <div className="space-y-5">
            <Field label={st.name}>
              <input className="field" value={form.name} onChange={(e) => update("name", e.target.value)} />
            </Field>

            <Field label={st.gender}>
              <Choices
                options={(["female", "male"] as const).map((g) => ({ value: g, label: t.gender[g] }))}
                value={form.gender}
                onChange={(v) => update("gender", v)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "age", label: st.age, unit: st.ageUnit },
                { key: "height", label: st.height, unit: "cm" },
                { key: "weight", label: st.weight, unit: "kg" },
              ].map(({ key, label, unit }) => (
                <Field key={key} label={label}>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      className="field pr-9"
                      value={form[key as keyof typeof form]}
                      onChange={(e) => update(key, e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>
                  </div>
                </Field>
              ))}
            </div>

            <Field label={pr.fitnessGoal}>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => update("goal", g)}
                    aria-pressed={form.goal === g}
                    className={`rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
                      form.goal === g ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                    }`}
                  >
                    {t.goals[g].label}
                  </button>
                ))}
              </div>
            </Field>

            {(form.goal === "lose_fat" || form.goal === "build_muscle") && (
              <Field label={st.targetWeight}>
                <input
                  type="number"
                  inputMode="decimal"
                  className="field"
                  placeholder={st.targetWeightPlaceholder}
                  value={form.targetWeight}
                  onChange={(e) => update("targetWeight", e.target.value)}
                />
              </Field>
            )}

            <Field label={pr.activityLevel}>
              <div className="space-y-2">
                {ACTIVITY_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => update("activityLevel", level)}
                    aria-pressed={form.activityLevel === level}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${
                      form.activityLevel === level ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-slate-100 dark:bg-white/5"
                    }`}
                  >
                    <span className="text-sm font-medium">{t.activity[level].label}</span>
                    <span className={`text-xs ${form.activityLevel === level ? "opacity-80" : "text-slate-500"}`}>{t.activity[level].desc}</span>
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-white/5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white/10">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function Choices({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${
            value === o.value ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

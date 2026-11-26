"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Camera, Loader2, X, Check } from "lucide-react";
import { aiHeaders } from "@/lib/byok-client";
import type { ImageAnalysisResult, TextAnalysisResult } from "@/lib/claude";
import { useI18n } from "./I18nProvider";

type Result = ImageAnalysisResult | TextAnalysisResult;

const MEALS = ["breakfast", "lunch", "snack", "dinner"] as const;

function mealByHour(): string {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}

/** Downscales a photo to ≤1568px JPEG (Claude's recommended max edge) to keep uploads small. */
async function fileToJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;

/**
 * Web version of the Telegram flow: describe a meal/workout or upload a photo,
 * review Claude's estimate, then save it to `date`'s log.
 * `bare` drops the card chrome (used inside the camera sheet).
 */
export default function AiQuickLog({
  today: date,
  bare = false,
  onSaved,
}: {
  today: string;
  bare?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const q = t.quickLog;
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [meal, setMeal] = useState(mealByHour);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const base64 = await fileToJpegBase64(file);
      setPhoto({ base64, preview: `data:image/jpeg;base64,${base64}` });
    } catch {
      setError(q.unreadableImage);
    }
  }

  async function analyze() {
    if (!photo && !text.trim()) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify(photo ? { imageBase64: photo.base64, mimeType: "image/jpeg", caption: text } : { text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || q.failed);
      if (data.result.type === "unknown") setError(q.notRecognised);
      else {
        setResult(data.result);
        if ("meal" in data.result && data.result.meal) setMeal(data.result.meal);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : q.failed);
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!result || result.type === "unknown") return;
    setSaving(true);
    try {
      const res =
        result.type === "food"
          ? await fetch("/api/food-log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date,
                meal,
                foodName: String(result.foodName).slice(0, 120),
                calories: round1(result.calories),
                protein: round1(result.protein),
                carbs: round1(result.carbs),
                fat: round1(result.fat),
                source: "web_ai",
              }),
            })
          : await fetch("/api/training-log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date,
                exercise: String(result.activity).slice(0, 120),
                duration: Math.max(0, Math.round(result.duration || 0)),
                completed: true,
                // Same notes shape as the Telegram bot so calories burned are counted.
                notes: JSON.stringify({
                  distance: result.distance,
                  pace: result.pace,
                  heartRate: result.heartRate,
                  caloriesBurned: result.caloriesBurned,
                  details: result.details,
                }),
              }),
            });
      if (!res.ok) throw new Error();
      setResult(null);
      setText("");
      setPhoto(null);
      router.refresh();
      onSaved?.();
    } catch {
      setError(q.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={photo ? q.photoPlaceholder : q.placeholder}
        className="field resize-none text-sm"
      />

      {photo && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          <img src={photo.preview} alt={q.photoAlt} className="h-24 rounded-2xl object-cover" />
          <button
            onClick={() => setPhoto(null)}
            className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white"
            aria-label={q.removePhoto}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="btn-soft cute-tap flex items-center gap-1.5 px-4 py-2.5 text-sm">
          <Camera size={16} /> {q.photo}
        </button>
        <button
          onClick={analyze}
          disabled={analyzing || (!photo && !text.trim())}
          className="btn-ink flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
        >
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {analyzing ? q.analyzing : q.analyze}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {result && result.type === "food" && (
        <div className="tint-lilac rounded-2xl p-3 text-sm">
          <div className="font-semibold">{result.foodName}</div>
          <div className="mt-1 text-slate-700 dark:text-slate-200">
            {Math.round(result.calories)} {t.common.kcal} · {t.common.macros.protein} {Math.round(result.protein)}g ·{" "}
            {t.common.macros.carbs} {Math.round(result.carbs)}g · {t.common.macros.fat} {Math.round(result.fat)}g
          </div>
          {"calorieRange" in result && result.calorieRange && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {q.range(Math.round(result.calorieRange.min), Math.round(result.calorieRange.max))}
            </div>
          )}
          <p className="mt-1 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">{result.description}</p>
          <div className="mt-3 flex gap-2">
            <select value={meal} onChange={(e) => setMeal(e.target.value)} className="field w-auto py-1.5 text-sm">
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {t.meals[m]}
                </option>
              ))}
            </select>
            <SaveButtons saving={saving} onSave={save} onCancel={() => setResult(null)} labels={{ log: q.log, cancel: t.common.cancel }} />
          </div>
        </div>
      )}

      {result && result.type === "workout" && (
        <div className="tint-aqua rounded-2xl p-3 text-sm">
          <div className="font-semibold">🏃 {result.activity}</div>
          <div className="mt-1 text-slate-700 dark:text-slate-200">
            {result.duration} {t.common.min}
            {result.distance && ` · ${result.distance}`}
            {result.pace && ` · ${result.pace}`}
            {result.caloriesBurned ? q.burnedKcal(Math.round(result.caloriesBurned)) : ""}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{result.suggestions}</p>
          <div className="mt-3 flex gap-2">
            <SaveButtons saving={saving} onSave={save} onCancel={() => setResult(null)} labels={{ log: q.log, cancel: t.common.cancel }} />
          </div>
        </div>
      )}
    </div>
  );

  if (bare) return body;
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2 font-semibold">
        <Sparkles size={18} className="text-[#8b7cf6]" /> {q.title}
      </div>
      {body}
    </div>
  );
}

function SaveButtons({
  saving,
  onSave,
  onCancel,
  labels,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  labels: { log: string; cancel: string };
}) {
  return (
    <>
      <button onClick={onSave} disabled={saving} className="btn-ink flex flex-1 items-center justify-center gap-1 py-1.5 text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {labels.log}
      </button>
      <button onClick={onCancel} className="rounded-full px-3 py-1.5 text-sm text-slate-500 hover:bg-white/70 dark:hover:bg-white/10">
        {labels.cancel}
      </button>
    </>
  );
}

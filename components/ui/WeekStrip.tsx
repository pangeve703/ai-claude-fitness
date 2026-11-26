"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, weekStart } from "@/lib/dates";
import { useI18n } from "../I18nProvider";

/**
 * Mon–Sun pills for the week containing `selected`. Each day links to
 * `${basePath}?date=…`; future days are disabled. `progress` (0–1, e.g. calories
 * eaten / target) draws a ring around the day number, like the reference design.
 */
export default function WeekStrip({
  selected,
  today,
  basePath,
  progress = {},
}: {
  selected: string;
  today: string;
  basePath: string;
  progress?: Record<string, number>;
}) {
  const { t } = useI18n();
  const monday = weekStart(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const prevWeek = addDays(selected, -7);
  const nextWeek = addDays(selected, 7) > today ? today : addDays(selected, 7);
  const canGoNext = weekStart(today) > monday;
  const href = (d: string) => (d === today ? basePath : `${basePath}?date=${d}`);
  const monthLabel = new Date(`${selected}T12:00:00Z`).toLocaleDateString(t.intl, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <Link href={href(prevWeek)} className="btn-soft flex h-7 w-7 items-center justify-center" aria-label={t.week.previous}>
            <ChevronLeft size={15} />
          </Link>
          {canGoNext ? (
            <Link href={href(nextWeek)} className="btn-soft flex h-7 w-7 items-center justify-center" aria-label={t.week.next}>
              <ChevronRight size={15} />
            </Link>
          ) : (
            <span className="btn-soft flex h-7 w-7 items-center justify-center opacity-40">
              <ChevronRight size={15} />
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between gap-1.5">
        {days.map((d, i) => {
          const isSelected = d === selected;
          const isFuture = d > today;
          const p = Math.min(Math.max(progress[d] ?? 0, 0), 1);
          const pill = (
            <div
              className={`flex w-full flex-col items-center gap-1 rounded-full py-1.5 transition-colors ${
                isSelected ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-white/85 text-slate-600 dark:bg-white/5 dark:text-slate-300"
              } ${isFuture ? "opacity-40" : ""}`}
            >
              <DayRing value={Number(d.slice(8))} progress={p} selected={isSelected} />
              <span className="text-[10px] font-medium uppercase tracking-wide">{t.days[i]}</span>
            </div>
          );
          return isFuture ? (
            <div key={d} className="flex-1" aria-disabled>
              {pill}
            </div>
          ) : (
            <Link key={d} href={href(d)} className="cute-tap flex-1" aria-current={isSelected ? "date" : undefined}>
              {pill}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DayRing({ value, progress, selected }: { value: number; progress: number; selected: boolean }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
      <circle cx="16" cy="16" r={r} fill="none" strokeWidth="2.5" className={selected ? "stroke-white/25 dark:stroke-ink/20" : "stroke-slate-200 dark:stroke-white/10"} />
      {progress > 0 && (
        <circle
          cx="16" cy="16" r={r} fill="none" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`}
          className={selected ? "stroke-white dark:stroke-ink" : "stroke-leaf"}
        />
      )}
      <text x="16" y="16" textAnchor="middle" dominantBaseline="central" transform="rotate(90 16 16)" className="fill-current text-[11px] font-semibold">
        {value}
      </text>
    </svg>
  );
}

/** "745 kcal left" ring from the reference: ink arc for what's been eaten, on a soft track. */
export default function CalorieRing({
  eaten,
  target,
  value,
  label,
  over = false,
}: {
  eaten: number;
  target: number;
  value: string;
  label: string;
  over?: boolean;
}) {
  const size = 136;
  const r = 56;
  const c = 2 * Math.PI * r;
  const p = Math.min(Math.max(eaten / Math.max(target, 1), 0), 1);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 136 136" className="-rotate-90">
        <circle cx="68" cy="68" r={r} fill="none" strokeWidth="11" className="stroke-white/70 dark:stroke-white/10" />
        <circle
          cx="68" cy="68" r={r} fill="none" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          className={over ? "stroke-flame" : "stroke-ink dark:stroke-white"}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-[28px] font-bold leading-none ${over ? "text-flame" : ""}`}>{value}</span>
        <span className="mt-1 text-xs text-slate-600 dark:text-slate-300">{label}</span>
      </div>
    </div>
  );
}

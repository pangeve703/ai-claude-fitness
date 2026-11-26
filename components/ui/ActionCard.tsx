import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Pastel row with an icon, title, subtitle and a chevron ("Log your water intake" style). */
export default function ActionCard({
  icon,
  title,
  subtitle,
  tint,
  href,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  tint: "tint-aqua" | "tint-lilac" | "tint-mint" | "tint-peach";
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 dark:bg-white/10">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-slate-600 dark:text-slate-300">{subtitle}</span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white">
        <ChevronRight size={15} />
      </span>
    </>
  );
  const className = `${tint} cute-tap flex w-full items-center gap-3 rounded-[1.5rem] px-4 py-3.5`;
  if (href) return <Link href={href} className={className}>{body}</Link>;
  return (
    <button onClick={onClick} className={className}>
      {body}
    </button>
  );
}

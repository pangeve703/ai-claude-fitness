"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Salad, Dumbbell, User, Camera } from "lucide-react";
import { useI18n } from "./I18nProvider";
import Sheet from "./Sheet";
import AiQuickLog from "./AiQuickLog";

const LEFT = [
  { href: "/dashboard", key: "home", icon: House },
  { href: "/diet", key: "diet", icon: Salad },
] as const;
const RIGHT = [
  { href: "/training", key: "training", icon: Dumbbell },
  { href: "/profile", key: "profile", icon: User },
] as const;

/**
 * Bottom bar: four tabs and a raised camera button in the middle that opens
 * AI logging (photo or text) from any page. `today` is the app-time-zone date
 * new entries are saved under.
 */
export default function NavBar({ today }: { today: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [quickLog, setQuickLog] = useState(false);

  const tab = ({ href, key, icon: Icon }: (typeof LEFT)[number] | (typeof RIGHT)[number]) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
          active ? "text-ink dark:text-white" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        }`}
      >
        <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
        {t.nav[key]}
      </Link>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-lg rounded-t-[1.75rem] bg-white/95 shadow-[0_-8px_30px_-12px_rgba(40,80,110,0.3)] backdrop-blur dark:bg-[#141a2b]/95 dark:shadow-none dark:ring-1 dark:ring-white/10">
          <div className="relative flex items-center px-2">
            {LEFT.map(tab)}
            <div className="flex-1" aria-hidden />
            {RIGHT.map(tab)}
            <button
              onClick={() => setQuickLog(true)}
              className="cute-tap absolute left-1/2 -top-7 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-ink text-white shadow-xl ring-[6px] ring-white/90 dark:bg-white dark:text-ink dark:ring-[#141a2b]"
              aria-label={t.quickLog.title}
            >
              <Camera size={24} />
            </button>
          </div>
        </div>
      </nav>
      {quickLog && (
        <Sheet title={t.quickLog.title} subtitle={t.quickLog.sheetSubtitle} onClose={() => setQuickLog(false)}>
          <AiQuickLog today={today} bare onSaved={() => setQuickLog(false)} />
        </Sheet>
      )}
    </>
  );
}

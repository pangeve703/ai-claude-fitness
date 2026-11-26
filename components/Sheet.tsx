"use client";
import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "./I18nProvider";

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Used by every popup so
 * they all behave the same:
 *  - z-[60], above the fixed nav bar (z-50), which used to cover the buttons
 *  - height capped to the visible viewport (dvh, so the on-screen keyboard
 *    doesn't push content off-screen); the body scrolls, the footer stays put
 *  - Escape, backdrop tap and the × button close it (unless `busy`)
 *  - page scroll is locked while open; role="dialog" + aria-modal for screen readers
 */
export default function Sheet({
  title,
  subtitle,
  icon,
  onClose,
  busy = false,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, busy]);

  return (
    <div
      className="cute-popup-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/30 px-3 pt-12 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="cute-popup-panel flex max-h-[calc(100dvh-4rem)] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] bg-white dark:bg-[#161d2e]"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden dark:bg-white/15" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-3">
          <div className="min-w-0">
            {icon}
            <h2 id={titleId} className={`text-lg font-semibold ${icon ? "mt-3" : ""}`}>
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="cute-tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-ink disabled:opacity-50 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
            aria-label={t.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {children && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>}

        {footer && (
          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/10">{footer}</div>
        )}
      </div>
    </div>
  );
}

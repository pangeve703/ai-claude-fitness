"use client";
import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useI18n } from "./I18nProvider";

// The root layout's inline script sets the `dark` class before first paint;
// this component only reads and flips it. useSyncExternalStore keeps the
// server render (always light) and the client from mismatching during hydration.
const EVENT = "themechange";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const isDark = () => document.documentElement.classList.contains("dark");

export default function ThemeToggle() {
  const { t } = useI18n();
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button onClick={toggle} className="btn-soft flex h-9 w-9 items-center justify-center" aria-label={t.nav.toggleTheme} aria-pressed={dark}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

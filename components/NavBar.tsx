"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, Dumbbell, User } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const nav = [
  { href: "/dashboard", label: "主页", icon: Home },
  { href: "/diet", label: "饮食", icon: UtensilsCrossed },
  { href: "/training", label: "训练", icon: Dumbbell },
  { href: "/profile", label: "我的", icon: User },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-50">
      <div className="max-w-lg mx-auto flex items-center">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                active
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
        <div className="flex flex-col items-center py-2 px-3">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

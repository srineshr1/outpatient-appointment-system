"use client";

import { Moon, Sun } from "@/components/icons";
import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink ${className}`.trim()}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

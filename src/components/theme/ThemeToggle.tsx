import { Moon, Sun } from "lucide-react";

import type { Theme } from "@/lib/theme";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-switch"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="switch" aria-hidden="true">
        <Sun className="icon sun" />
        <Moon className="icon moon" />
      </span>
    </button>
  );
}

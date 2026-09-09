"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("proofowl-theme", next);
    } catch {
      /* storage blocked — the choice just won't persist */
    }
  }

  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={toggle}
      aria-label={
        mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Toggle theme"
      }
      title="Toggle theme"
    >
      {mounted ? (theme === "dark" ? "☾ Dark" : "☀ Light") : "Theme"}
    </button>
  );
}

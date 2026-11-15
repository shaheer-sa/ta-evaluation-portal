"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // private mode etc: still switches for this visit
    }
    setDark(next);
  }

  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      className="tams-iconbtn"
      onClick={toggle}
      aria-label={label}
      data-tip={label}
      data-tip-pos="bottom-end"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRetro } from "@/context/RetroContext";

type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextType = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "theme-mode";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isRetro } = useRetro();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      setModeState(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const apply = (isDark: boolean) => {
      setResolvedTheme(isDark ? "dark" : "light");
      if (isRetro) {
        root.classList.remove("dark");
        return;
      }
      root.classList.toggle("dark", isDark);
    };

    let mediaQuery: MediaQueryList | null = null;
    let handler: ((event: MediaQueryListEvent) => void) | null = null;

    if (isRetro) {
      root.classList.remove("dark");
      return;
    }

    if (mode === "system") {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mediaQuery.matches);
      handler = (event) => apply(event.matches);
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handler);
      } else {
        mediaQuery.addListener(handler);
      }
      return () => {
        if (!mediaQuery || !handler) return;
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handler);
        } else {
          mediaQuery.removeListener(handler);
        }
      };
    }

    apply(mode === "dark");
  }, [mode, isRetro]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleTheme = () => {
    const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

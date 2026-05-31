"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextType = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "theme-mode";
const THEME_BACKGROUND = {
  light: "#ffffff",
  dark: "#1f1f1f",
} as const;
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyDocumentTheme(isDark: boolean) {
  const resolvedTheme = isDark ? "dark" : "light";
  const background = THEME_BACKGROUND[resolvedTheme];
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  root.style.backgroundColor = background;
  document.body.style.backgroundColor = background;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", background);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      setModeState(saved);
    }
    setInitialized(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialized) return;

    const apply = (isDark: boolean) => {
      setResolvedTheme(isDark ? "dark" : "light");
      applyDocumentTheme(isDark);
    };

    let mediaQuery: MediaQueryList | null = null;
    let handler: ((event: MediaQueryListEvent) => void) | null = null;

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
  }, [initialized, mode]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleTheme = () => {
    const next =
      mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
  };

  return (
    <ThemeContext.Provider
      value={{ mode, resolvedTheme, setMode, toggleTheme }}
    >
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

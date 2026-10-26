"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_THEME,
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/theme/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeId;
}) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);

  useEffect(() => {
    let stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (!stored) {
      const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY) as ThemeId | null;
      if (legacy) {
        stored = legacy;
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
          window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
        } catch { /* ignore */ }
      }
    }
    if (stored && stored !== theme) setThemeState(stored);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, t);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    } catch {}
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

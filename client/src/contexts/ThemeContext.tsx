"use client";
/* Theme context: light/dark via `.dark` on <html>, persisted, defaults to system.
   A pre-paint inline script in the root layout prevents flash. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "architech.theme";
type Theme = "light" | "dark";

type ThemeCtx = { theme: Theme; toggle: () => void };
const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(stored === "dark" || stored === "light" ? stored : system);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { window.localStorage.setItem(KEY, next); } catch { /* private mode */ }
      return next;
    });
  };

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

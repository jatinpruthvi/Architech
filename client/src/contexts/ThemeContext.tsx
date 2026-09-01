"use client";
/* Theme context: light/dark via `.dark` on <html>, persisted. The product is
   **night-first**: it reserves "dark" as its default and landing state — a
   fresh visitor, or one with no stored choice and no matching system
   preference, opens on the night atlas. Light is the deliberate toggle, not
   the default. A stored preference always wins so the choice survives.
   The initial theme is applied in a layout effect, which runs synchronously
   before the browser paints — the same flash-prevention the old pre-paint
   inline <script> in the root layout provided, but without rendering any
   <script> through the React tree (React dev builds warn on those, and
   next/script's inline queue is still such a script). */
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

const KEY = "architech.theme";
type Theme = "light" | "dark";

type ThemeCtx = { theme: Theme; toggle: () => void };
const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });

/* Layout effects run before paint on the client, so the stored/system theme
   is applied with no visible flash. On the server the fallback is useEffect,
   which is a no-op there and avoids React's SSR useLayoutEffect warning. */
const usePrePaintEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* Night-first: "dark" on server AND client first render, so the night atlas
     is the landing state. The real preference is read after mount: a stored
     choice always wins; otherwise we bias to dark (the brand default) rather
     than to the system, because this product is deliberately a night survey. */
  const [theme, setTheme] = useState<Theme>("dark");

  usePrePaintEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(KEY); } catch { /* private mode */ }
    setTheme(stored === "light" || stored === "dark" ? stored : "dark");
  }, []);

  usePrePaintEffect(() => {
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

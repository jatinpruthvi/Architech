"use client";
/* Language context: en/hi, persisted, sets <html lang>. Defaults to English
   on first paint to avoid hydration mismatches, then hydrates preference. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { strings, type Lang, type Strings } from "@/lib/i18n";

const KEY = "architech.lang";

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: Strings };
const Ctx = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: strings.en });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "hi" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(KEY, l); } catch { /* private mode */ }
  };

  return <Ctx.Provider value={{ lang, setLang, t: strings[lang] as Strings }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

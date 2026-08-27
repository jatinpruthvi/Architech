"use client";

/* ARCHITECH — Amdavad Modern compare state: anonymous persistence, max four homes, reversible feedback. */
import { createContext, useCallback, useEffect, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "architech.compare.v1";
const MAX_COMPARE = 4;

type CompareCtx = { compared: string[]; isCompared: (id: string) => boolean; toggle: (id: string) => void; clear: () => void };

const Ctx = createContext<CompareCtx>({ compared: [], isCompared: () => false, toggle: () => {}, clear: () => {} });

function readStored(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compared, setCompared] = useState<string[]>([]);

  useEffect(() => { setCompared(readStored()); }, []);
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compared)); } catch { /* private mode or blocked storage */ }
  }, [compared]);

  const toggle = useCallback((id: string) => {
    setCompared((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) {
        toast("Compare holds four homes", { description: "Remove one from the tray below to add another." });
        return prev;
      }
      toast(prev.length === 0 ? "Added to compare" : `Added home ${prev.length + 1} of ${MAX_COMPARE}`, {
        description: prev.length + 1 >= 2 ? "Open the comparison tray when you are ready." : "Pick another home to compare side by side.",
      });
      return [...prev, id];
    });
  }, []);

  const isCompared = useCallback((id: string) => compared.includes(id), [compared]);
  const clear = useCallback(() => setCompared([]), []);

  return <Ctx.Provider value={{ compared, isCompared, toggle, clear }}>{children}</Ctx.Provider>;
}

export const useCompare = () => useContext(Ctx);

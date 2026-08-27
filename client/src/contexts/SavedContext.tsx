"use client";

/* Shared saved-homes state, persisted to localStorage. */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { loadSaved, persistSaved, toggleSaved } from "@/lib/saved";

type SavedCtx = { saved: string[]; isSaved: (id: string) => boolean; toggle: (id: string) => boolean };

const Ctx = createContext<SavedCtx>({ saved: [], isSaved: () => false, toggle: () => false });

export function SavedProvider({ children }: { children: ReactNode }) {
  /* Lazy init: no empty-state flash on /saved (guarded for future SSR) */
  const [saved, setSaved] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadSaved(window.localStorage),
  );

  const toggle = useCallback((id: string) => {
    const wasSaved = saved.includes(id);
    setSaved((prev) => {
      const next = toggleSaved(prev, id);
      try {
        if (typeof window !== "undefined") persistSaved(window.localStorage, next);
      } catch {
        // Private browsing and storage quotas should not block the shortlist UI.
      }
      return next;
    });
    return !wasSaved;
  }, [saved]);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  return <Ctx.Provider value={{ saved, isSaved, toggle }}>{children}</Ctx.Provider>;
}

export const useSaved = () => useContext(Ctx);

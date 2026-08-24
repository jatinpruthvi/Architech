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
    setSaved((prev) => {
      const next = toggleSaved(prev, id);
      persistSaved(window.localStorage, next);
      return next;
    });
    return !saved.includes(id);
  }, [saved]);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  return <Ctx.Provider value={{ saved, isSaved, toggle }}>{children}</Ctx.Provider>;
}

export const useSaved = () => useContext(Ctx);

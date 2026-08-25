/* Compare selection (max 2 homes) + drawer tray. */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";

type CompareCtx = { compared: string[]; isCompared: (id: string) => boolean; toggle: (id: string) => void; clear: () => void };

const Ctx = createContext<CompareCtx>({ compared: [], isCompared: () => false, toggle: () => {}, clear: () => {} });

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compared, setCompared] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setCompared((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        toast("Compare holds two homes", { description: "Remove one from the tray below to add another." });
        return prev;
      }
      if (prev.length === 0) toast("Added to compare", { description: "Pick one more home to compare side by side." });
      return [...prev, id];
    });
  }, []);

  const isCompared = useCallback((id: string) => compared.includes(id), [compared]);
  const clear = useCallback(() => setCompared([]), []);

  return <Ctx.Provider value={{ compared, isCompared, toggle, clear }}>{children}</Ctx.Provider>;
}

export const useCompare = () => useContext(Ctx);

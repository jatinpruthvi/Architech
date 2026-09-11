"use client";

/* Shared saved-homes state, persisted to localStorage. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { adoptLegacySaved, loadSaved, mergeGuestSaved, persistSaved, toggleSaved } from "@/lib/saved";
import { useSession } from "@/contexts/SessionContext";

type SavedCtx = { saved: string[]; isSaved: (id: string) => boolean; toggle: (id: string) => boolean };

const Ctx = createContext<SavedCtx>({ saved: [], isSaved: () => false, toggle: () => false });

export function SavedProvider({ children }: { children: ReactNode }) {
  /* Start empty on server AND client, then load after mount. Reading
     localStorage in the useState initializer made the client's first render
     differ from the SSR HTML (saved badge present vs absent), which aborted
     hydration with "Hydration failed because the server rendered HTML didn't
     match the client". */
  const [saved, setSaved] = useState<string[]>([]);
  const { session, status } = useSession();
  /* The shortlist is per account, so the identity it is stored under has to
     be a ref as well as a dependency: `toggle` writes on the next tick and
     must not persist to the key of whoever was signed in when it was built. */
  const userId = session?.user.id ?? null;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  useEffect(() => {
    /* Wait for the session to resolve. Loading during "loading" would read
       the guest list for a signed-in person and then overwrite their account
       list with it on the first toggle. */
    if (status === "loading") return;
    try {
      adoptLegacySaved(window.localStorage);
      setSaved(userId ? mergeGuestSaved(window.localStorage, userId) : loadSaved(window.localStorage, null));
    } catch {
      setSaved([]);
    }
  }, [status, userId]);

  const toggle = useCallback((id: string) => {
    const wasSaved = saved.includes(id);
    setSaved((prev) => {
      const next = toggleSaved(prev, id);
      try {
        if (typeof window !== "undefined") persistSaved(window.localStorage, next, userIdRef.current);
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

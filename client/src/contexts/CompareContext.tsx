"use client";

/* ARCHITECH — Amdavad Modern compare state: per-account persistence, max
   four homes, reversible feedback.
 *
 * The tray used to live under one unscoped `architech.compare.v1` key — the
 * same shared-device leak the shortlist had before `lib/saved.ts` scoped it
 * (see docs/dashboard/second-audit-findings.md, which flags this context for
 * exactly this fix). Signed-out visitors keep a guest tray; sign-in merges
 * it, mirroring SavedProvider. */
import { createContext, useCallback, useEffect, useContext, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { adoptLegacyCompare, loadCompared, MAX_COMPARE, mergeGuestCompare, persistCompared } from "@/lib/compare";
import { useSession } from "@/contexts/SessionContext";

type CompareCtx = { compared: string[]; isCompared: (id: string) => boolean; toggle: (id: string) => void; clear: () => void };

const Ctx = createContext<CompareCtx>({ compared: [], isCompared: () => false, toggle: () => {}, clear: () => {} });

export function CompareProvider({ children }: { children: ReactNode }) {
  /* Empty on server AND client; load after mount (hydration agreement). */
  const [compared, setCompared] = useState<string[]>([]);
  const { session, status } = useSession();
  const userId = session?.user.id ?? null;
  /* Persist to whoever is signed in at write time, not at build time. */
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  useEffect(() => {
    /* Wait for the session; loading early would read the guest tray for a
       signed-in person and clobber the account tray on first toggle. */
    if (status === "loading") return;
    try {
      adoptLegacyCompare(window.localStorage);
      setCompared(userId ? mergeGuestCompare(window.localStorage, userId) : loadCompared(window.localStorage, null));
    } catch {
      setCompared([]);
    }
  }, [status, userId]);

  const toggle = useCallback((id: string) => {
    setCompared((prev) => {
      if (prev.includes(id)) {
        persistCompared(window.localStorage, prev.filter((x) => x !== id), userIdRef.current);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_COMPARE) {
        toast("Compare holds four homes", { description: "Remove one from the tray below to add another." });
        return prev;
      }
      toast(prev.length === 0 ? "Added to compare" : `Added home ${prev.length + 1} of ${MAX_COMPARE}`, {
        description: prev.length + 1 >= 2 ? "Open the comparison tray when you are ready." : "Pick another home to compare side by side.",
      });
      const next = [...prev, id];
      persistCompared(window.localStorage, next, userIdRef.current);
      return next;
    });
  }, []);

  const isCompared = useCallback((id: string) => compared.includes(id), [compared]);
  const clear = useCallback(() => {
    setCompared([]);
    if (typeof window !== "undefined") persistCompared(window.localStorage, [], userIdRef.current);
  }, []);

  return <Ctx.Provider value={{ compared, isCompared, toggle, clear }}>{children}</Ctx.Provider>;
}

export const useCompare = () => useContext(Ctx);

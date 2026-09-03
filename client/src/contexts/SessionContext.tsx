"use client";
/* Client session context.
 *
 * One place the whole UI asks "who is signed in?", so the header, the login
 * page and any protected surface cannot drift apart. It reads the SAME
 * `/api/auth/session` contract the server guards use, so the client never
 * derives authorisation of its own — it only reflects what the server already
 * decided. Client state here is a convenience for rendering; every actual
 * permission check still happens server-side in `authorizeRequest`.
 *
 * `status` is a three-state value on purpose. Collapsing "loading" into
 * "signed out" makes every protected page flash its signed-out state on first
 * paint and, worse, makes a redirect-on-unauthenticated guard fire before the
 * session has been fetched.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthSession } from "@/lib/auth/roles";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "unavailable";

type SessionPayload = {
  authenticated: boolean;
  session: AuthSession | null;
  canAccessBrokerDashboard: boolean;
  source: string;
};

type SessionContextValue = {
  status: SessionStatus;
  session: AuthSession | null;
  canAccessBrokerDashboard: boolean;
  refresh: () => Promise<AuthSession | null>;
  signOut: () => Promise<void>;
  /** Adopt a session returned by the login route without a second round trip. */
  adopt: (session: AuthSession) => void;
};

const SessionContext = createContext<SessionContextValue>({
  status: "loading",
  session: null,
  canAccessBrokerDashboard: false,
  refresh: async () => null,
  signOut: async () => {},
  adopt: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [canAccessBrokerDashboard, setCanAccess] = useState(false);
  /* Abort an in-flight fetch when a newer one starts (or the tree unmounts),
     otherwise a slow first request can land after a sign-out and resurrect a
     stale session in the UI. */
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const response = await fetch("/api/auth/session/", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
      if (response.status === 503) {
        setStatus("unavailable");
        setSession(null);
        setCanAccess(false);
        return null;
      }
      const payload = (await response.json()) as SessionPayload;
      setSession(payload.session ?? null);
      setCanAccess(Boolean(payload.canAccessBrokerDashboard));
      setStatus(payload.authenticated && payload.session ? "authenticated" : "unauthenticated");
      return payload.session ?? null;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      setStatus("unavailable");
      setSession(null);
      setCanAccess(false);
      return null;
    }
  }, []);

  const adopt = useCallback((next: AuthSession) => {
    setSession(next);
    setStatus("authenticated");
    setCanAccess(next.user.role !== "BUYER" && Boolean(next.organization));
    /* Still re-read from the server: `adopt` is a latency optimisation, and the
       server contract remains the authority on permissions. */
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      setSession(null);
      setCanAccess(false);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => inFlight.current?.abort();
  }, [refresh]);

  const value = useMemo(
    () => ({ status, session, canAccessBrokerDashboard, refresh, signOut, adopt }),
    [status, session, canAccessBrokerDashboard, refresh, signOut, adopt],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

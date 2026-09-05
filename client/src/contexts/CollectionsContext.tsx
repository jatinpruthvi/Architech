"use client";

/* Collections state, persisted to localStorage per account.
 *
 * Was a single unscoped key — the shared-device leak the shortlist fix
 * documented in docs/dashboard/second-audit-findings.md ("scoped the same
 * way before launch"). Signed-out visitors keep guest collections; sign-in
 * merges them into the account, mirroring SavedProvider. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { adoptLegacyCollections, createCollection, deleteCollection, loadCollections, mergeGuestCollections, persistCollections, toggleCollectionListing, updateCollection, type Collection } from "@/lib/collections";
import { useSession } from "@/contexts/SessionContext";

type CollectionsContextValue = {
  collections: Collection[];
  add: (name: string, note?: string) => void;
  update: (id: string, patch: Partial<Pick<Collection, "name" | "note">>) => void;
  toggleListing: (collectionId: string, listingId: string) => void;
  remove: (id: string) => void;
};

const Context = createContext<CollectionsContextValue>({ collections: [], add: () => undefined, update: () => undefined, toggleListing: () => undefined, remove: () => undefined });

export function CollectionsProvider({ children }: { children: ReactNode }) {
  /* Same hydration rule as SavedProvider: server and client first render must
     agree, so localStorage is read after mount, not in the initializer. */
  const [collections, setCollections] = useState<Collection[]>([]);
  const { session, status } = useSession();
  const userId = session?.user.id ?? null;
  /* Writes must land under whoever is signed in at write time (setState
     scheduling), not when the callback was built. */
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  useEffect(() => {
    /* Wait for the session to resolve; loading during "loading" would read
       guest collections for a signed-in person and then overwrite their
       account collections on first write. */
    if (status === "loading") return;
    try {
      adoptLegacyCollections(window.localStorage);
      setCollections(userId ? mergeGuestCollections(window.localStorage, userId) : loadCollections(window.localStorage, null));
    } catch {
      setCollections([]);
    }
  }, [status, userId]);

  const commit = useCallback((next: Collection[]) => {
    setCollections(next);
    if (typeof window !== "undefined") persistCollections(window.localStorage, next, userIdRef.current);
  }, []);
  const add = useCallback((name: string, note = "") => commit(createCollection(collections, name, note)), [collections, commit]);
  const update = useCallback((id: string, patch: Partial<Pick<Collection, "name" | "note">>) => commit(updateCollection(collections, id, patch)), [collections, commit]);
  const toggleListing = useCallback((collectionId: string, listingId: string) => commit(toggleCollectionListing(collections, collectionId, listingId)), [collections, commit]);
  const remove = useCallback((id: string) => commit(deleteCollection(collections, id)), [collections, commit]);
  return <Context.Provider value={{ collections, add, update, toggleListing, remove }}>{children}</Context.Provider>;
}

export const useCollections = () => useContext(Context);

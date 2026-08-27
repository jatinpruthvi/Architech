"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createCollection, deleteCollection, loadCollections, persistCollections, toggleCollectionListing, updateCollection, type Collection } from "@/lib/collections";

type CollectionsContextValue = {
  collections: Collection[];
  add: (name: string, note?: string) => void;
  update: (id: string, patch: Partial<Pick<Collection, "name" | "note">>) => void;
  toggleListing: (collectionId: string, listingId: string) => void;
  remove: (id: string) => void;
};

const Context = createContext<CollectionsContextValue>({ collections: [], add: () => undefined, update: () => undefined, toggleListing: () => undefined, remove: () => undefined });

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Collection[]>(() => typeof window === "undefined" ? [] : loadCollections(window.localStorage));
  const commit = useCallback((next: Collection[]) => {
    setCollections(next);
    if (typeof window !== "undefined") persistCollections(window.localStorage, next);
  }, []);
  const add = useCallback((name: string, note = "") => commit(createCollection(collections, name, note)), [collections, commit]);
  const update = useCallback((id: string, patch: Partial<Pick<Collection, "name" | "note">>) => commit(updateCollection(collections, id, patch)), [collections, commit]);
  const toggleListing = useCallback((collectionId: string, listingId: string) => commit(toggleCollectionListing(collections, collectionId, listingId)), [collections, commit]);
  const remove = useCallback((id: string) => commit(deleteCollection(collections, id)), [collections, commit]);
  return <Context.Provider value={{ collections, add, update, toggleListing, remove }}>{children}</Context.Provider>;
}

export const useCollections = () => useContext(Context);

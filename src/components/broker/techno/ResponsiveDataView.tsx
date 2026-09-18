"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { preferredInventoryView, type InventoryView } from "./view-preference";

const STORAGE_KEY = "architech.broker.inventory-view";

export function ResponsiveDataView({
  cards,
  table,
  cardsLabel,
}: {
  cards: React.ReactNode;
  table: React.ReactNode;
  cardsLabel: string;
}) {
  const [mode, setMode] = useState<InventoryView>("table");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage may be blocked; viewport preference still works.
    }
    setMode(preferredInventoryView(saved, window.matchMedia("(max-width: 767px)").matches));
  }, []);

  function choose(next: InventoryView) {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice remains valid for this page when storage is unavailable.
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[var(--tp-muted)]">
          Choose the view that fits your task
        </p>
        <div className="tp-view-toggle" role="group" aria-label="Inventory view">
          <button
            type="button"
            aria-label="Card view"
            aria-pressed={mode === "cards"}
            className="tp-view-option"
            onClick={() => choose("cards")}
          >
            <LayoutGrid size={16} /> <span>Cards</span>
          </button>
          <button
            type="button"
            aria-label="Table view"
            aria-pressed={mode === "table"}
            className="tp-view-option"
            onClick={() => choose("table")}
          >
            <Table2 size={16} /> <span>Table</span>
          </button>
        </div>
      </div>
      <div className={mode === "cards" ? "block" : "hidden"} role="region" aria-label={cardsLabel}>
        {cards}
      </div>
      <div className={mode === "table" ? "block" : "hidden"}>{table}</div>
    </div>
  );
}

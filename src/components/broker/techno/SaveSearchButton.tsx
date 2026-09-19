"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkCheck, BookmarkPlus, Check, Loader2 } from "lucide-react";
import type { SavedSearchFilters } from "@/lib/technoproperty/repository";

export function SaveSearchButton({ filters }: { filters: SavedSearchFilters }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string }>({ kind: "idle" });
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus the name field when the form opens (ref-based: the a11y rule bans
  // autoFocus, and a ref lets the focus follow the user's action).
  useEffect(() => {
    if (open) nameInputRef.current?.focus();
  }, [open]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setState({ kind: "idle" });
    try {
      const res = await fetch("/api/broker/technoproperty/saved-search/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, filters }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setState({ kind: "error", message: data?.error === "INVALID_NAME" ? "Give the search a name (max 120 characters)." : "Could not save. Please try again." });
      } else {
        setState({ kind: "saved" });
        setName("");
        setOpen(false);
      }
    } catch {
      setState({ kind: "error", message: "Could not save. Check your connection." });
    }
    setBusy(false);
  }

  if (state.kind === "saved") {
    return (
      <span className="tp-chip tp-chip-green min-h-11 px-3">
        <Check size={14} /> Saved — new matches appear in My Activities
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex min-h-11 items-center gap-2">
        <button
          type="button"
          className={`tp-btn min-h-11 justify-center ${open ? "tp-btn-ghost" : "tp-btn-primary"}`}
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            setState({ kind: "idle" });
          }}
        >
          {open ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />} Save this search
        </button>
      </div>
      {open ? (
        <form
          className="flex flex-col items-end gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center gap-2">
            <input
              ref={nameInputRef}
              aria-label="Saved search name"
              className="tp-input min-h-11 w-56 text-sm"
              placeholder="e.g. Satellite 2BHK under 25k"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className="tp-btn tp-btn-primary min-h-11 justify-center" disabled={busy || !name.trim()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
          </div>
          <p className="text-right text-xs text-[var(--tp-muted)]">
            New listings matching these filters will show in My Activities.
          </p>
          {state.kind === "error" ? <p role="alert" className="text-right text-xs font-semibold text-[var(--tp-rose)]">{state.message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

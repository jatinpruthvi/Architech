"use client";
import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";

export function NoteEditor({ propertyId, initialText = "" }: { propertyId: string; initialText?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialText || "");
  const [saved, setSaved] = useState(initialText || "");
  const [busy, setBusy] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/broker/technoproperty/note", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, text }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(text);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block" ref={popRef}>
      <button
        type="button"
        title={saved ? `Note: ${saved}` : "Add note"}
        aria-label={saved ? "Edit note" : "Add note"}
        data-tp-action="note"
        onClick={() => {
          setText(saved);
          setOpen((v) => !v);
        }}
        className={`tp-action-btn ${saved ? "bg-[#e0fbf0] !text-[#0e8a65] !border-[#b6ebd3]" : "bg-[#f0f7ff] !text-[#1d5fc2] !border-[#c7dffa]"}`}
      >
        <Pencil size={15} />
      </button>
      {saved ? (
        <span className="ml-1 align-middle text-[10px] text-[var(--tp-muted)]">
          {saved.length > 20 ? saved.slice(0, 20) + "…" : saved}
        </span>
      ) : null}
      {open ? (
        <div className="absolute left-8 top-0 z-20 w-72 rounded-xl border border-[var(--tp-border)] bg-white p-3 shadow-lg">
          <p className="mb-1 text-[11px] font-semibold uppercase text-[var(--tp-muted)]">Private note</p>
          <textarea
            className="tp-input min-h-[80px] w-full resize-none"
            value={text}
            autoFocus
            placeholder="e.g. wrong info it's 2bhk · call again Monday"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button className="tp-btn tp-btn-ghost !py-1 !px-2 !text-xs" onClick={() => setOpen(false)}>
              <X size={12} /> Cancel
            </button>
            <button className="tp-btn tp-btn-primary !py-1 !px-2 !text-xs" onClick={save} disabled={busy}>
              <Check size={12} /> {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

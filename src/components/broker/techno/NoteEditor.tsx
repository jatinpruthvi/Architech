"use client";

import { useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NoteEditor({
  propertyId,
  initialText = "",
  showLabel = false,
}: {
  propertyId: string;
  initialText?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialText || "");
  const [saved, setSaved] = useState(initialText || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/technoproperty/note/", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError("Could not save. Please try again.");
        return;
      }
      setSaved(text);
      setOpen(false);
    } catch {
      setError("Could not save. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={showLabel ? "relative" : "relative inline-block"}>
        <DialogTrigger asChild>
          <button
            type="button"
            title={saved ? `Note: ${saved}` : "Add note"}
            aria-label={saved ? "Edit note" : "Add note"}
            data-tp-action="note"
            onClick={() => {
              setText(saved);
              setError(null);
            }}
            className={`${showLabel ? "tp-mobile-action w-full" : "tp-action-btn"} ${saved ? "bg-[#e0fbf0] !border-[#b6ebd3] !text-[#0e8a65]" : "bg-[#f0f7ff] !border-[#c7dffa] !text-[#1d5fc2]"}`}
          >
            <Pencil size={16} />
            {showLabel ? <span>{saved ? "Edit note" : "Note"}</span> : null}
          </button>
        </DialogTrigger>
        {saved && !showLabel ? (
          <span className="ml-1 align-middle text-[10px] text-[var(--tp-muted)]">
            {saved.length > 20 ? saved.slice(0, 20) + "…" : saved}
          </span>
        ) : null}
      </div>

      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          textAreaRef.current?.focus();
        }}
        className="techno tp-note-dialog !bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] !left-3 !right-3 !top-auto !w-auto !max-w-none !translate-x-0 !translate-y-0 rounded-2xl border border-[var(--tp-border)] bg-white p-4 text-[var(--tp-ink)] shadow-2xl md:!bottom-auto md:!left-1/2 md:!right-auto md:!top-1/2 md:!w-[22rem] md:!-translate-x-1/2 md:!-translate-y-1/2"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="font-display text-lg font-bold text-[var(--tp-ink)]">Private note</DialogTitle>
            <DialogDescription className="mt-1 text-xs text-[var(--tp-muted)]">
              Only your brokerage team can see this property note.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button type="button" className="tp-icon-touch -mr-2 -mt-2" aria-label="Close note">
              <X size={18} />
            </button>
          </DialogClose>
        </div>
        <textarea
          ref={textAreaRef}
          aria-label="Property note"
          className="tp-input min-h-[112px] w-full resize-none"
          value={text}
          placeholder="Example: confirm 2 BHK details; call again Monday"
          onChange={(event) => setText(event.target.value)}
        />
        {error ? <p role="alert" className="text-xs font-semibold text-[var(--tp-rose)]">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <button type="button" className="tp-btn tp-btn-ghost min-h-11 justify-center">
              Cancel
            </button>
          </DialogClose>
          <button type="button" className="tp-btn tp-btn-primary min-h-11 justify-center" onClick={save} disabled={busy}>
            <Check size={14} /> {busy ? "Saving…" : "Save note"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

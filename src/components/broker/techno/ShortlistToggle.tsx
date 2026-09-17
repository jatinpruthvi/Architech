"use client";
import { useState } from "react";
import { Bookmark } from "lucide-react";

export function ShortlistToggle({ propertyId, initially = false }: { propertyId: string; initially?: boolean }) {
  const [shortlisted, setShortlisted] = useState(initially);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !shortlisted;
    setShortlisted(next);
    try {
      await fetch("/api/broker/technoproperty/shortlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, shortlisted: next }),
      });
    } catch {
      setShortlisted(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`tp-action-btn bookmark ${shortlisted ? "active" : ""}`}
      title={shortlisted ? "Shortlisted" : "Shortlist"}
      data-tp-action={shortlisted ? "bookmark" : "bookmark"}
      onClick={toggle}
      disabled={busy}
      aria-label={shortlisted ? "Shortlisted" : "Shortlist"}
      aria-pressed={shortlisted}
    >
      <Bookmark size={14} fill={shortlisted ? "currentColor" : "none"} />
    </button>
  );
}

"use client";
import { useState } from "react";
import { Bookmark } from "lucide-react";
import { persistShortlist } from "./shortlist-request";

export function ShortlistToggle({
  propertyId,
  initially = false,
  showLabel = false,
}: {
  propertyId: string;
  initially?: boolean;
  showLabel?: boolean;
}) {
  const [shortlisted, setShortlisted] = useState(initially);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = !shortlisted;
    setShortlisted(next);
    const result = await persistShortlist(propertyId, next);
    if (!result.ok) {
      setShortlisted(!next);
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <div className={showLabel ? "min-w-0" : "inline-flex flex-col items-start"}>
      <button
        type="button"
        className={`${showLabel ? "tp-mobile-action w-full" : "tp-action-btn bookmark"} ${shortlisted ? "active" : ""}`}
        title={error ?? (shortlisted ? "Shortlisted" : "Shortlist")}
        data-tp-action="bookmark"
        onClick={toggle}
        disabled={busy}
        aria-label={busy ? "Saving shortlist" : error ? "Shortlist update failed. Retry" : shortlisted ? "Shortlisted" : "Shortlist"}
        aria-pressed={shortlisted}
        aria-busy={busy}
      >
        <Bookmark size={16} fill={shortlisted ? "currentColor" : "none"} />
        {showLabel ? <span>{busy ? "Saving…" : shortlisted ? "Saved" : error ? "Retry" : "Save"}</span> : null}
      </button>
      {error ? (
        <p role="alert" className={`mt-1 text-[10px] font-semibold leading-4 text-[var(--tp-rose)] ${showLabel ? "" : "max-w-28"}`}>
          Not saved. Tap to retry.
        </p>
      ) : null}
    </div>
  );
}

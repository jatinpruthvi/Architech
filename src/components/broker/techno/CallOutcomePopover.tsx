"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Check, Handshake, PhoneIncoming, PhoneOff } from "lucide-react";
import { persistCallOutcome } from "./call-outcome-request";

const OUTCOMES: { key: string; label: string; icon: typeof Check; tone: string }[] = [
  { key: "connected", label: "Connected", icon: PhoneIncoming, tone: "green" },
  { key: "no_answer", label: "No answer", icon: PhoneOff, tone: "slate" },
  { key: "wrong_number", label: "Wrong number", icon: AlertTriangle, tone: "rose" },
  { key: "follow_up", label: "Follow up", icon: Calendar, tone: "amber" },
  { key: "deal", label: "Deal", icon: Handshake, tone: "violet" },
];

/* Tones resolve in the token layer: .tp-tint-* / .tp-solid-* (src/theme.css). */

export function CallOutcomePopover({
  propertyId,
  initialOutcome,
  onLogged,
}: {
  propertyId: string;
  initialOutcome?: string | null;
  onLogged?: (outcome: string) => void;
}) {
  const [outcome, setOutcome] = useState<string | null>(initialOutcome ?? null);
  const [busy, setBusy] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* `follow_up` is only real once it has a date: pick a day, THEN persist.
     Without this the outcome saved but nothing ever resurfaced it. */
  const [pickingFollowUp, setPickingFollowUp] = useState(false);

  useEffect(() => {
    if (initialOutcome && !outcome) setOutcome(initialOutcome);
  }, [initialOutcome, outcome]);

  async function log(next: string, followUpAt?: string) {
    if (busy) return;
    if (next === "follow_up" && !followUpAt) {
      setOutcome("follow_up");
      setPickingFollowUp(true);
      return;
    }
    setPickingFollowUp(false);
    setBusy(true);
    setSavingOutcome(next);
    setMessage(null);
    setError(null);
    const result = await persistCallOutcome(propertyId, next, followUpAt ?? null);
    if (result.ok) {
      setOutcome(next);
      setMessage(next === "follow_up" ? "Follow-up scheduled" : "Outcome saved");
      onLogged?.(next);
    } else {
      setError(result.error);
    }
    setBusy(false);
    setSavingOutcome(null);
  }

  function followUpDate(offsetDays: number): string {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    d.setHours(9, 30, 0, 0);
    return d.toISOString();
  }

  const savingLabel = OUTCOMES.find((item) => item.key === savingOutcome)?.label;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1" data-tp-action-group="outcome" aria-label="Log call outcome">
        {OUTCOMES.map(({ key, label, icon: Icon, tone }) => {
          const active = outcome === key;
          return (
            <button
              key={key}
              type="button"
              data-tp-outcome={key}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:brightness-95 ${active ? `tp-solid-${tone}` : `tp-tint-${tone}`}`}
              disabled={busy}
              onClick={() => log(key)}
              title={label}
              aria-label={savingOutcome === key ? `Saving ${label}` : label}
              aria-pressed={active}
            >
              <Icon size={12} aria-hidden="true" />{label}{active ? <Check size={10} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      {pickingFollowUp ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Choose follow-up date">
          <span className="text-xs font-semibold text-[var(--tp-muted)]">Call back:</span>
          {([["Tomorrow", 1], ["In 2 days", 2], ["Next week", 7]] as const).map(([label, days]) => (
            <button
              key={days}
              type="button"
              className="tp-tint-amber inline-flex min-h-9 items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:brightness-95"
              disabled={busy}
              onClick={() => log("follow_up", followUpDate(days))}
            >
              <Calendar size={12} className="mr-1" aria-hidden="true" />{label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-1 min-h-5 text-xs" aria-live="polite" aria-atomic="true">
        {busy && savingLabel ? <p className="font-semibold text-[var(--tp-muted)]">Saving {savingLabel.toLowerCase()}…</p> : null}
        {!busy && message ? <p className="font-semibold text-[var(--tp-accent-2)]">{message}</p> : null}
        {error ? <p role="alert" className="font-semibold text-[var(--tp-rose)]">{error}</p> : null}
      </div>
    </div>
  );
}

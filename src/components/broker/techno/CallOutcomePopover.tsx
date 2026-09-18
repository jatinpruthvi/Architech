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

const toneMap: Record<string, string> = {
  green: "#0e8a65",
  slate: "#39495b",
  rose: "#c12e4c",
  amber: "#8a5b0b",
  violet: "#5e35c9",
};
const toneBg: Record<string, string> = {
  green: "#e0fbf0",
  slate: "#e8eef5",
  rose: "#ffe2e9",
  amber: "#fff2d4",
  violet: "#efe6ff",
};

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

  useEffect(() => {
    if (initialOutcome && !outcome) setOutcome(initialOutcome);
  }, [initialOutcome, outcome]);

  async function log(next: string) {
    if (busy) return;
    setBusy(true);
    setSavingOutcome(next);
    setMessage(null);
    setError(null);
    const result = await persistCallOutcome(propertyId, next);
    if (result.ok) {
      setOutcome(next);
      setMessage("Outcome saved");
      onLogged?.(next);
    } else {
      setError(result.error);
    }
    setBusy(false);
    setSavingOutcome(null);
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
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:brightness-95"
              style={{
                color: active ? "#fff" : toneMap[tone],
                background: active ? toneMap[tone] : toneBg[tone],
                outline: active ? `2px solid ${toneMap[tone]}` : "none",
                outlineOffset: 1,
              }}
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
      <div className="mt-1 min-h-5 text-xs" aria-live="polite" aria-atomic="true">
        {busy && savingLabel ? <p className="font-semibold text-[var(--tp-muted)]">Saving {savingLabel.toLowerCase()}…</p> : null}
        {!busy && message ? <p className="font-semibold text-[var(--tp-accent-2)]">{message}</p> : null}
        {error ? <p role="alert" className="font-semibold text-[var(--tp-rose)]">{error}</p> : null}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Check, PhoneIncoming, PhoneOff, AlertTriangle, Handshake, Calendar } from "lucide-react";

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
  amber: "#b27b0b",
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

  useEffect(() => {
    if (initialOutcome && !outcome) setOutcome(initialOutcome);
  }, [initialOutcome, outcome]);

  async function log(next: string) {
    if (busy) return;
    // Allow re-selecting: clicking the same chip again is a no-op, picking a
    // different one overwrites the visual selection immediately and persists.
    setBusy(true);
    setOutcome(next);
    try {
      await fetch("/api/broker/technoproperty/call-outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, outcome: next }),
      });
      onLogged?.(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1" data-tp-action-group="outcome">
      {OUTCOMES.map(({ key, label, icon: Icon, tone }) => {
        const active = outcome === key;
        return (
          <button
            key={key}
            type="button"
            data-tp-outcome={key}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:brightness-95"
            style={{
              color: active ? "#fff" : toneMap[tone],
              background: active ? toneMap[tone] : toneBg[tone],
              outline: active ? `2px solid ${toneMap[tone]}` : "none",
              outlineOffset: 1,
            }}
            disabled={busy}
            onClick={() => log(key)}
            title={label}
            aria-pressed={active}
          >
            <Icon size={12} />{label}{active ? <Check size={10} /> : null}
          </button>
        );
      })}
    </div>
  );
}

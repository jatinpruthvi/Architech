"use client";

import { useId, useEffect, useState } from "react";
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

export const FOLLOW_UP_DEFAULT_TIME = "09:30";
const FOLLOW_UP_MAX_DAYS = 90;

/** "YYYY-MM-DD" (+ optional "HH:MM") → ISO datetime in the broker's local
 *  time. Returns null on anything unparseable — the API must never receive a
 *  promise we cannot honour on the day we said we would. */
export function buildFollowUpIso(dateValue: string, timeValue?: string): string | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  if (!date) return null;
  const time = /^(\d{1,2}):(\d{2})$/.exec((timeValue?.trim() || FOLLOW_UP_DEFAULT_TIME).trim());
  if (!time) return null;
  const y = Number(date[1]);
  const mo = Number(date[2]);
  const d = Number(date[3]);
  const h = Number(time[1]);
  const mi = Number(time[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  /* JS rolls "2026-02-30" into March 2 silently — round-trip the components
     so impossible dates are rejected, not re-dated. */
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/** Allowed custom range, as "YYYY-MM-DD" (lexicographically comparable). A
 *  follow-up is a promise for the FUTURE: tomorrow at the earliest, 90 days
 *  out at the latest — the quick chips already cover the near days. */
export function followUpBounds(): { min: string; max: string } {
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const min = new Date();
  min.setDate(min.getDate() + 1);
  const max = new Date();
  max.setDate(max.getDate() + FOLLOW_UP_MAX_DAYS);
  return { min: fmt(min), max: fmt(max) };
}

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
  /* `follow_up` is only real once it has a date (+ time): pick it, THEN
     persist. Without this the outcome saved but nothing ever resurfaced it. */
  const [pickingFollowUp, setPickingFollowUp] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const dateInputId = useId();
  const timeInputId = useId();

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

  function scheduleCustom() {
    const { min, max } = followUpBounds();
    if (!customDate) {
      setError("Pick a date for the follow-up.");
      return;
    }
    if (customDate < min || customDate > max) {
      setError(`Pick a date between ${min} and ${max}.`);
      return;
    }
    const iso = buildFollowUpIso(customDate, customTime || undefined);
    if (!iso) {
      setError("That date and time don't look valid — try again.");
      return;
    }
    setCustomDate("");
    setCustomTime("");
    void log("follow_up", iso);
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
        <div className="mt-2 space-y-1.5" role="group" aria-label="Choose follow-up date and time">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--tp-muted)]">Call back:</span>
            {([["Tomorrow", 1], ["In 2 days", 2], ["Next week", 7]] as const).map(([label, days]) => (
              <button
                key={days}
                type="button"
                className="tp-tint-amber inline-flex min-h-11 items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:brightness-95"
                disabled={busy}
                onClick={() => log("follow_up", followUpDate(days))}
              >
                <Calendar size={12} className="mr-1" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <label htmlFor={dateInputId} className="text-xs font-semibold text-[var(--tp-muted)]">
              Or exact day &amp; time:
            </label>
            <input
              id={dateInputId}
              type="date"
              className="tp-input min-h-11 !px-2 !py-1 text-xs"
              value={customDate}
              min={followUpBounds().min}
              max={followUpBounds().max}
              disabled={busy}
              onChange={(event) => setCustomDate(event.target.value)}
            />
            <input
              id={timeInputId}
              aria-label="Follow-up time"
              type="time"
              step={900}
              className="tp-input min-h-11 !px-2 !py-1 text-xs"
              value={customTime}
              disabled={busy}
              onChange={(event) => setCustomTime(event.target.value)}
            />
            <button
              type="button"
              className="tp-btn tp-btn-primary min-h-11 !px-3"
              disabled={busy}
              onClick={scheduleCustom}
            >
              <Calendar size={13} className="mr-1" aria-hidden="true" />Schedule
            </button>
          </div>
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

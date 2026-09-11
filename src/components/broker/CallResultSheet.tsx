"use client";
/* Post-call result sheet — the workflow doc's "Log call result" (§2, §3).

   THE HONESTY CONSTRAINT, restated where it is easiest to violate:
   this sheet opens on `visibilitychange` when the broker returns from the
   device dialer. That event proves the broker came BACK. It does not prove the
   call connected, how long it ran, or whether anyone spoke. So there is no
   pre-filled outcome, no duration field, and no "call connected ✓" claim
   anywhere. The broker selects what actually happened. Inventing telephony
   evidence here would put fabricated data into a pipeline that later issues
   invoices against it.

   The sheet is also reachable manually from the lead's action row, because
   `visibilitychange` does not fire reliably on every Android browser when
   returning from a native dialer. A missed auto-open must never mean a lost
   call log.

   BUNDLE: this component is loaded with next/dynamic by BrokerLeadDetail.
   vaul + the sheet markup must not sit in the route's first-load JS — the same
   reason FilterSheet.tsx documents for the /search filter drawer, and the same
   240 KB gzip ceiling in config/performance/budgets.json. */

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { AlertTriangle, PhoneOff } from "lucide-react";
import { useState } from "react";
import {
  CALL_OUTCOMES,
  CALL_OUTCOME_LABELS,
  LEAD_STAGE_LABELS,
  OUTCOME_RULES,
  nextStageFor,
  type CallOutcome,
  type LeadStage,
} from "@/lib/leads/calling";

export type LoggedCall = {
  outcome: CallOutcome;
  stageAfter: LeadStage;
  nextActionAt: string | null;
  lostReason: string | null;
  note: string | null;
};

const FIELD_LABEL = "stamp block mb-2 ink-3";
const FIELD_INPUT =
  "w-full border border-ink/18 bg-paper px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brick focus:ring-2 focus:ring-brick/25";

function requiredLabel(requires: (typeof OUTCOME_RULES)[CallOutcome]["requires"]): string | null {
  switch (requires) {
    case "RETRY_AT":
      return "Retry at";
    case "FOLLOWUP_AT":
      return "Follow-up at";
    case "APPOINTMENT_AT":
      return "Site visit date and time";
    case "NOTE_AND_FOLLOWUP":
      return "Next follow-up at";
    case "LOST_REASON":
      return "Reason lost";
    case "NOTHING":
      return null;
  }
}

export default function CallResultSheet({
  open,
  onOpenChange,
  leadName,
  stageBefore,
  autoOpened,
  onLog,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  stageBefore: LeadStage;
  /** True when the sheet opened because the broker returned from the dialer.
      Shown as context, never as a claim about the call itself. */
  autoOpened: boolean;
  onLog: (logged: LoggedCall) => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rule = outcome ? OUTCOME_RULES[outcome] : null;
  const needsWhen = rule !== null && rule.requires !== "LOST_REASON" && rule.requires !== "NOTHING";
  const needsReason = rule?.requires === "LOST_REASON";
  const stageAfter = outcome ? nextStageFor(stageBefore, outcome) : stageBefore;

  function reset() {
    setOutcome(null);
    setWhen("");
    setReason("");
    setNote("");
    setError(null);
  }

  function save() {
    if (!outcome || !rule) {
      setError("Choose what happened on the call.");
      return;
    }
    if (needsWhen && !when) {
      setError(`${requiredLabel(rule.requires)} is required for this outcome.`);
      return;
    }
    if (needsReason && reason.trim().length < 3) {
      setError("A reason is required before a lead can be marked lost.");
      return;
    }
    onLog({
      outcome,
      stageAfter,
      nextActionAt: needsWhen && when ? new Date(when).toISOString() : null,
      lostReason: needsReason ? reason.trim() : null,
      note: note.trim() ? note.trim() : null,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DrawerContent className="border-t-2 border-brick bg-paper">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-2xl font-medium tracking-[-0.02em]">Log call result</DrawerTitle>
          <DrawerDescription className="ink-2 mt-1 text-sm leading-6">
            {leadName} · stage stays <strong className="font-semibold text-ink">{LEAD_STAGE_LABELS[stageBefore]}</strong> until you
            save.
          </DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[58dvh] overflow-y-auto px-4 pb-2">
          {autoOpened && (
            <p className="mb-4 flex items-start gap-2.5 border-l-2 border-trust bg-trust/8 px-3 py-2.5 text-xs leading-5 ink-2">
              <PhoneOff size={14} className="mt-0.5 shrink-0 text-trust" aria-hidden="true" />
              <span>
                You came back from the dialer. We do not know whether the call connected — tell us what happened so the record is
                true.
              </span>
            </p>
          )}

          <fieldset>
            <legend className={FIELD_LABEL}>What happened</legend>
            <div className="grid gap-2">
              {CALL_OUTCOMES.map((value) => {
                const selected = outcome === value;
                const suppresses = OUTCOME_RULES[value].suppressesContact;
                return (
                  /* htmlFor + a static aria-label rather than relying on the
                     nested text: the visible label is a lookup expression
                     (`CALL_OUTCOME_LABELS[value]`) that jsx-a11y cannot evaluate
                     statically, so without an explicit accessible name the row
                     reads as an unnamed control to a screen reader too. */
                  <label
                    key={value}
                    htmlFor={`call-outcome-${value}`}
                    aria-label={CALL_OUTCOME_LABELS[value]}
                    className={`flex cursor-pointer items-start gap-3 border px-3.5 py-3 transition ${
                      selected ? "border-brick bg-brick/8" : "border-ink/15 bg-card hover:border-ink/30"
                    }`}
                  >
                    <input
                      id={`call-outcome-${value}`}
                      type="radio"
                      name="call-outcome"
                      value={value}
                      checked={selected}
                      onChange={() => {
                        setOutcome(value);
                        setError(null);
                      }}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--brick)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-5 text-ink">{CALL_OUTCOME_LABELS[value]}</span>
                      <span className="stamp mt-1 block ink-3">
                        {suppresses ? "Permanently suppresses this number" : `Stage → ${LEAD_STAGE_LABELS[nextStageFor(stageBefore, value)]}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {rule?.suppressesContact && (
            <p className="mt-3 flex items-start gap-2.5 border-l-2 border-ember bg-ember/8 px-3 py-2.5 text-xs leading-5 ink-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-ember" aria-hidden="true" />
              <span>
                Saving this outcome puts the number on the do-not-call list. It cannot be dialled from Architech again.
              </span>
            </p>
          )}

          {needsWhen && (
            <div className="mt-4">
              <label className={FIELD_LABEL} htmlFor="call-next-action">
                {requiredLabel(rule!.requires)} <span className="text-brick">required</span>
              </label>
              <input
                id="call-next-action"
                type="datetime-local"
                value={when}
                onChange={(event) => {
                  setWhen(event.target.value);
                  setError(null);
                }}
                className={`${FIELD_INPUT} touch-44`}
              />
            </div>
          )}

          {needsReason && (
            <div className="mt-4">
              <label className={FIELD_LABEL} htmlFor="call-lost-reason">
                Reason lost <span className="text-brick">required</span>
              </label>
              <input
                id="call-lost-reason"
                type="text"
                value={reason}
                placeholder="Bought elsewhere, budget changed, wrong number…"
                onChange={(event) => {
                  setReason(event.target.value);
                  setError(null);
                }}
                className={`${FIELD_INPUT} touch-44`}
              />
            </div>
          )}

          <div className="mt-4">
            <label className={FIELD_LABEL} htmlFor="call-note">
              Note <span className="ink-3">optional</span>
            </label>
            <textarea
              id="call-note"
              rows={3}
              value={note}
              placeholder="What was said, what they asked for, what you promised."
              onChange={(event) => setNote(event.target.value)}
              className={`${FIELD_INPUT} resize-none leading-6`}
            />
          </div>

          {error && (
            <p role="alert" className="mt-3 border-l-2 border-ember bg-ember/8 px-3 py-2.5 text-xs leading-5 text-ember">
              {error}
            </p>
          )}
        </div>

        <div className="safe-bottom sticky bottom-0 flex gap-2 border-t border-ink/12 bg-paper px-4 py-3">
          <DrawerClose asChild>
            <button type="button" className="touch-44 border border-ink/18 px-5 py-3.5 stamp font-semibold ink-2">
              Not now
            </button>
          </DrawerClose>
          <button
            type="button"
            onClick={save}
            className="clay-fill touch-44 flex-1 bg-brick py-3.5 stamp font-semibold text-cream"
          >
            Save result
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

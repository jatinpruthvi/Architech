"use client";

import { useId, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronDown, Zap } from "lucide-react";
import { CallOutcomePopover } from "./CallOutcomePopover";
import { ContactRevealButton } from "./ContactRevealButton";
import { applyLoggedOutcome, outcomeCounts, summarizeCallQueue, type LoggedOutcomes, type OutcomeFilter } from "./call-queue-state";
import { callStateLabel, type CallState } from "@/lib/technoproperty/call-lifecycle";

export interface CallQueueRow {
  id: string;
  premiseName: string | null;
  area: string | null;
  address: string | null;
  rentPriceRaw: string | null;
  keyInfo: string | null;
  availabilityRaw: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerPhoneLast4: string | null;
  revealed: boolean;
  currentOutcome: string | null;
  callState?: "new" | "retry" | "followup" | "scheduled" | "done";
  followUpAt?: Date | string | null;
  lastOutcomeAt?: Date | string | null;
  daysAgo: number | null;
  note: { text: string } | null;
}

export function CallQueueList({ rows, scheduledCount = 0 }: { rows: CallQueueRow[]; scheduledCount?: number }) {
  const [loggedOutcomes, setLoggedOutcomes] = useState<LoggedOutcomes>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OutcomeFilter>("all");
  const [showScheduled, setShowScheduled] = useState(false);
  const scheduledId = useId();
  const completedId = useId();
  const nextHeadingRef = useRef<HTMLHeadingElement>(null);
  const summary = summarizeCallQueue(rows, loggedOutcomes);
  const counts = outcomeCounts(rows, loggedOutcomes);
  /* Click a status on the progress card to see (and call back) exactly those
     owners — the filtered views feed both sections below. */
  const matchesFilter = (row: CallQueueRow) => {
    if (statusFilter === "all") return true;
    const outcome = loggedOutcomes[row.id] ?? row.currentOutcome ?? null;
    return statusFilter === "new" ? outcome === null : outcome === statusFilter;
  };
  const pendingView = summary.pending.filter(matchesFilter);
  const completedView = summary.completed.filter(matchesFilter);
  const activeLabel = STATUS_CHIPS.find((chip) => chip.key === statusFilter)?.label ?? null;

  function handleLogged(propertyId: string, outcome: string, advance: boolean) {
    setLoggedOutcomes((current) => applyLoggedOutcome(current, propertyId, outcome));
    setQueueMessage(advance ? "Outcome saved. Continue with the next owner." : "Updated outcome saved.");
    if (advance) requestAnimationFrame(() => nextHeadingRef.current?.focus());
  }

  if (summary.total === 0) {
    return (
      <div className="tp-card tp-empty text-center">
        <CheckCircle2 size={28} className="mx-auto text-[var(--tp-accent-2)]" aria-hidden="true" />
        <h2 className="mt-2 font-display text-lg font-bold text-[var(--tp-ink)]">You’re all caught up</h2>
        <p className="mt-1 text-sm text-[var(--tp-muted)]">Every fresh listing in today’s queue has an outcome.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="tp-call-progress" aria-label="Call queue progress">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--tp-accent)]">Today’s progress</p>
            <p className="mt-1 font-display text-xl font-bold text-[var(--tp-ink)]">
              {summary.completedCount} of {summary.total} calls logged
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scheduledCount > 0 ? (
              <span className="tp-chip tp-chip-amber"><CalendarClock size={13} aria-hidden="true" />{scheduledCount} scheduled</span>
            ) : null}
            <span className="tp-chip tp-chip-green"><Zap size={13} aria-hidden="true" />{summary.pending.length} remaining</span>
          </div>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--tp-border)]"
          role="progressbar"
          aria-label="Daily call progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.percent}
        >
          <div className="h-full rounded-full bg-[var(--tp-accent-2)] transition-[width] motion-reduce:transition-none" style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="mt-2 min-h-5 text-xs font-semibold text-[var(--tp-accent-2)]" role="status" aria-live="polite">
          {queueMessage}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter calls by status">
          <span className="text-xs font-semibold text-[var(--tp-muted)]">Status:</span>
          {STATUS_CHIPS.map(({ key, label, tone }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(active ? "all" : key)}
                title={active ? `Showing ${label.toLowerCase()} calls — click to clear` : `Show ${label.toLowerCase()} calls`}
                className={`tp-chip tp-chip-${tone} min-h-9 cursor-pointer px-2.5 ${active ? `tp-solid-${tone}` : ""}`}
              >
                {label} <span className="opacity-70">{counts[key]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="next-calls-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="next-calls-title" ref={nextHeadingRef} tabIndex={-1} className="font-display text-lg font-bold text-[var(--tp-ink)] focus:outline-none">
            {statusFilter === "all" ? (summary.pending.length > 0 ? "Next to call" : "Queue complete") : activeLabel}
          </h2>
          {statusFilter !== "all" ? (
            <button type="button" className="tp-chip tp-chip-blue min-h-9 cursor-pointer px-2.5" onClick={() => setStatusFilter("all")}>
              Clear filter ✕
            </button>
          ) : summary.pending.length > 0 ? (
            <span className="text-xs font-semibold text-[var(--tp-muted)]">Newest first</span>
          ) : null}
        </div>
        {pendingView.length > 0 ? (
          <div className="mt-2 space-y-2">
            {pendingView.map((row, index) => (
              <CallQueueCard
                key={row.id}
                row={row}
                sequence={statusFilter === "all" ? index + 1 : undefined}
                outcome={loggedOutcomes[row.id] ?? row.currentOutcome}
                onLogged={(outcome) => handleLogged(row.id, outcome, true)}
              />
            ))}
          </div>
        ) : (
          <div className="tp-card mt-2 text-center">
            <CheckCircle2 size={26} className="mx-auto text-[var(--tp-accent-2)]" aria-hidden="true" />
            <p className="mt-2 font-semibold text-[var(--tp-ink)]">
              {statusFilter === "all" ? "Great work—today’s queue is complete." : "No calls with this status right now."}
            </p>
          </div>
        )}
      </section>

      {summary.scheduled.length > 0 && (statusFilter === "all" || statusFilter === "follow_up") ? (
        <section>
          <button
            type="button"
            className="tp-completed-toggle min-h-11"
            aria-expanded={showScheduled}
            aria-controls={scheduledId}
            onClick={() => setShowScheduled((value) => !value)}
          >
            <span><CalendarClock size={17} aria-hidden="true" /> {summary.scheduled.length} scheduled follow-{summary.scheduled.length === 1 ? "up" : "ups"}</span>
            <ChevronDown size={18} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${showScheduled ? "rotate-180" : ""}`} />
          </button>
          {showScheduled ? (
            <div id={scheduledId} className="mt-2 space-y-2">
              {summary.scheduled.map((row) => (
                <CallQueueCard
                  key={row.id}
                  row={row}
                  outcome={loggedOutcomes[row.id] ?? row.currentOutcome}
                  onLogged={(outcome) => handleLogged(row.id, outcome, false)}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {completedView.length > 0 ? (
        <section>
          <button
            type="button"
            className="tp-completed-toggle min-h-11"
            aria-expanded={showCompleted}
            aria-controls={completedId}
            onClick={() => setShowCompleted((value) => !value)}
          >
            <span><CheckCircle2 size={17} aria-hidden="true" /> {completedView.length} {statusFilter === "all" ? "completed" : activeLabel?.toLowerCase()} {completedView.length === 1 ? "call" : "calls"}</span>
            <ChevronDown size={18} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${showCompleted ? "rotate-180" : ""}`} />
          </button>
          {showCompleted ? (
            <div id={completedId} className="mt-2 space-y-2">
              {completedView.map((row) => (
                <CallQueueCard
                  key={row.id}
                  row={row}
                  outcome={loggedOutcomes[row.id] ?? row.currentOutcome}
                  onLogged={(outcome) => handleLogged(row.id, outcome, false)}
                  completed
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function CallQueueCard({
  row,
  sequence,
  outcome,
  onLogged,
  completed = false,
}: {
  row: CallQueueRow;
  sequence?: number;
  outcome: string | null;
  onLogged: (outcome: string) => void;
  completed?: boolean;
}) {
  return (
    <article className={`tp-card flex flex-col gap-3 md:flex-row md:items-start md:gap-4 ${completed ? "tp-tint-neutral" : ""}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {sequence ? (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full tp-tint-blue text-xs font-bold" aria-label={`Queue position ${sequence}`}>
            {sequence}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold text-[var(--tp-ink)]">
            {row.premiseName || row.area || "Property"}
            {row.daysAgo !== null && row.daysAgo <= 1 ? (
              <span className="tp-chip tp-chip-green">New today</span>
            ) : row.daysAgo !== null ? (
              <span className="tp-chip tp-chip-slate">{row.daysAgo}d old</span>
            ) : null}
            <DueChip callState={(row.callState ?? null) as CallState | null} followUpAt={row.followUpAt ?? null} lastOutcomeAt={row.lastOutcomeAt ?? null} />
          </p>
          <p className="mt-1 text-sm leading-5 text-[var(--tp-ink-soft)]">{row.address || row.area || "Address not listed"}</p>
          <p className="mt-1 text-xs text-[var(--tp-muted)]">{[row.rentPriceRaw, row.keyInfo, row.availabilityRaw].filter(Boolean).join(" · ")}</p>
          {row.note?.text ? (
            <p className="mt-2 rounded-lg tp-tint-amber rounded-lg p-2 text-xs">Note: {row.note.text}</p>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 shrink-0 md:max-w-[32rem]">
        <ContactRevealButton
          propertyId={row.id}
          initialName={row.ownerName}
          initialPhone={row.ownerPhone}
          initialPhoneLast4={row.ownerPhoneLast4}
          initialRevealed={row.revealed}
        />
        <CallOutcomePopover propertyId={row.id} initialOutcome={outcome} onLogged={onLogged} />
      </div>
    </article>
  );
}

function DueChip({
  callState,
  followUpAt,
  lastOutcomeAt,
}: {
  callState: CallState | null;
  followUpAt: Date | string | null;
  lastOutcomeAt: Date | string | null;
}) {
  if (!callState || callState === "new" || callState === "done") return null;
  const label = callStateLabel({ callState, followUpAt, lastOutcomeAt });
  if (!label) return null;
  return <span className={`tp-chip ${callState === "followup" ? "tp-chip-amber" : "tp-chip-slate"}`}>{label}</span>;
}

const STATUS_CHIPS: { key: Exclude<OutcomeFilter, "all">; label: string; tone: string }[] = [
  { key: "new", label: "Not called", tone: "blue" },
  { key: "no_answer", label: "No answer", tone: "slate" },
  { key: "follow_up", label: "Follow-up", tone: "amber" },
  { key: "connected", label: "Connected", tone: "green" },
  { key: "deal", label: "Deal", tone: "violet" },
  { key: "wrong_number", label: "Wrong number", tone: "rose" },
];

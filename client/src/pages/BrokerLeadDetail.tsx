"use client";
/* Broker lead detail — the mobile calling surface.

   PROTOTYPE (see docs/leads/mobile-calling-implementation-plan.md §7 Phase 1/3).
   Data comes from lib/leads/calling-prototype-data.ts because the real lead's
   phone number is not stored yet; the gate logic in lib/leads/calling.ts and
   the shape of this page are the things that ship.

   WHY A DETAIL ROUTE AND NOT AN EXPANDING LIST ROW
   There was no lead detail page at all (`find app -path '*leads*' -name
   page.tsx` returned only the list). Calling from a list row means the action
   bar competes with every other row's actions for thumb space, and there is
   nothing to deep-link a notification to. A full-screen lead with the dialer
   anchored to the bottom edge is the shape that works one-handed.

   THE REVEAL ROUND-TRIP
   The Call control is not an `<a href="tel:…">` on first paint, because the
   number is not in the payload — `GET /api/broker/leads` stays masked-only by
   design. The first tap asks the gate; on success the anchor gains its href and
   the dialer opens in the same gesture. Every later tap is a single action.
   On failure the button explains itself instead of going dead. */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  FlaskConical,
  Lock,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import StatusBadge from "@/components/architech/StatusBadge";
import useTitle from "@/hooks/useTitle";
import {
  DEFAULT_CALLING_HOURS,
  LEAD_STAGE_LABELS,
  REVEAL_BLOCKED_COPY,
  decideReveal,
  isWithinCallingHours,
  planAllowsReveal,
  type BrokerPlanStatus,
  type CallOutcome,
  type LeadStage,
} from "@/lib/leads/calling";
import { findPrototypeLead, PROTOTYPE_LEADS, type PrototypeLead } from "@/lib/leads/calling-prototype-data";
import { telLink, waMeLink } from "@/lib/interop/phone";

/* Dynamic on purpose: vaul plus the sheet's markup stays out of this route's
   first-load JS, under the 240 KB gzip ceiling in performance/budgets.json.
   Same rule FilterSheet.tsx documents for /search. */
const CallResultSheet = dynamic(() => import("@/components/broker/CallResultSheet"), { ssr: false });

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} d ago`;
}

function GradeBadge({ lead }: { lead: PrototypeLead }) {
  const tone = lead.grade === "hot" ? "ember" : lead.grade === "warm" ? "trust" : "neutral";
  return (
    <StatusBadge tone={tone}>
      {lead.grade} · {lead.score}
    </StatusBadge>
  );
}

export default function BrokerLeadDetail({ leadId }: { leadId: string }) {
  useTitle("Lead · broker desk");
  const router = useRouter();
  const lead = findPrototypeLead(leadId);

  /* ---- prototype-only controls (removed when the real gate lands) ---- */
  const [planStatus, setPlanStatus] = useState<BrokerPlanStatus>("ACTIVE");
  const [simulateClosedHours, setSimulateClosedHours] = useState(false);
  const [showPrototypePanel, setShowPrototypePanel] = useState(false);

  /* ---- real state ---- */
  const [stage, setStage] = useState<LeadStage>(lead?.stage ?? "NEW");
  const [attempts, setAttempts] = useState(lead?.callAttempts ?? 0);
  const [suppressed, setSuppressed] = useState(lead?.suppressed ?? false);
  const [revealedNumber, setRevealedNumber] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAutoOpened, setSheetAutoOpened] = useState(false);
  const [loggedOutcomes, setLoggedOutcomes] = useState<CallOutcome[]>([]);

  const dialingRef = useRef(false);
  const callAnchorRef = useRef<HTMLAnchorElement | null>(null);

  const maxAttempts = lead?.maxAttempts ?? 3;

  /* The gate, evaluated from the same inputs the server will use. In Phase 3
     this moves behind POST /api/broker/leads/[id]/reveal and the client only
     renders the answer. */
  const evaluateGate = useCallback(() => {
    if (!lead) return { ok: false as const, reason: "NOT_OWNED" as const };
    const now = new Date();
    return decideReveal({
      planStatus,
      hasPermission: true,
      ownedBySessionOrg: true,
      humanFirstTouch: true,
      suppressed,
      withinCallingHours: simulateClosedHours ? false : isWithinCallingHours(now, DEFAULT_CALLING_HOURS),
      attemptsRemaining: attempts < maxAttempts,
      contactStored: lead.contactStored,
    });
  }, [lead, planStatus, suppressed, simulateClosedHours, attempts, maxAttempts]);

  /* Returning from the native dialer. `visibilitychange` proves the broker came
      back — nothing more — so it opens the self-report sheet rather than
      recording an outcome. Registered only while a dial is actually in flight,
      so merely backgrounding the phone does not nag. */
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible" && dialingRef.current) {
        dialingRef.current = false;
        setSheetAutoOpened(true);
        setSheetOpen(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!lead) {
    return (
      <div className="bg-paper pt-[78px] text-ink">
        <div className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
          <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">Enquiry not found</h1>
          <p className="ink-2 mt-3 max-w-[380px] text-sm leading-6">
            This lead is not in your organization&rsquo;s inbox, or it has been removed.
          </p>
          <Link href="/broker/leads/" className="clay-fill touch-44 mt-8 inline-flex items-center gap-2 bg-brick px-6 py-3.5 stamp font-semibold text-cream">
            <ArrowLeft size={14} /> Back to inbox
          </Link>
        </div>
      </div>
    );
  }

  const gate = evaluateGate();
  const blockedCopy = !gate.ok ? REVEAL_BLOCKED_COPY[gate.reason] : null;
  const planLocked = !planAllowsReveal(planStatus);

  async function onCallTap() {
    if (revealedNumber) return; // the anchor's own href handles the dial
    const decision = evaluateGate();
    if (!decision.ok) {
      const copy = REVEAL_BLOCKED_COPY[decision.reason];
      toast(copy.title, { description: copy.body });
      return;
    }
    setRevealing(true);
    try {
      /* Phase 3 replaces this with the reveal POST, which also writes the
         `lead.contact.revealed` AuditEvent. The prototype decrypts nothing
         because nothing is encrypted yet. */
      await new Promise((resolve) => setTimeout(resolve, 260));
      const number = lead!.phoneE164;
      setRevealedNumber(number);
      setAttempts((current) => current + 1);
      dialingRef.current = true;
      /* Set the href imperatively before navigating: React has not re-rendered
         yet, and a top-level `location.assign("tel:…")` inside the gesture
         continuation is what actually opens the dialer on iOS Safari and Chrome
         for Android. `window.open` would be popup-blocked. */
      if (callAnchorRef.current) callAnchorRef.current.href = telLink(number);
      window.location.assign(telLink(number));
    } finally {
      setRevealing(false);
    }
  }

  function onLogged(logged: { outcome: CallOutcome; stageAfter: LeadStage; nextActionAt: string | null }) {
    setStage(logged.stageAfter);
    setLoggedOutcomes((current) => [...current, logged.outcome]);
    const rule = OUTCOME_SUPPRESSES[logged.outcome];
    if (rule) setSuppressed(true);
    setSheetAutoOpened(false);
    toast("Call result recorded.", {
      description: `Stage is now ${LEAD_STAGE_LABELS[logged.stageAfter]}${logged.nextActionAt ? " · follow-up scheduled" : ""}.`,
    });
  }

  const attemptsLeft = Math.max(0, maxAttempts - attempts);

  return (
    <div className="bg-paper pb-[104px] pt-[78px] text-ink">
      <div className="container">
        {/* back row */}
        <div className="flex items-center justify-between gap-3 py-4">
          <Link href="/broker/leads/" className="touch-44 inline-flex items-center gap-2 stamp font-semibold text-brick">
            <ArrowLeft size={15} /> Inbox
          </Link>
          <div className="flex items-center gap-2">
            <GradeBadge lead={lead} />
          </div>
        </div>

        {/* identity */}
        <header className="border-t border-ink/12 pt-5">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-t-full bg-night font-display text-xl text-cream" aria-hidden="true">
              {lead.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[28px] font-medium leading-tight tracking-[-0.02em]">{lead.name}</h1>
              <p className="ink-2 mt-1 truncate text-sm">{lead.listingTitle}</p>
              <p className="stamp mt-1.5 ink-3">
                {lead.listingId} · {lead.locality}, {lead.city}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge tone={lead.status === "NEW" ? "ember" : "neutral"}>{lead.status.toLowerCase()}</StatusBadge>
            <span className="status-badge status-badge-trust stamp font-semibold">{LEAD_STAGE_LABELS[stage]}</span>
            <span className="stamp ink-3">enquired {timeAgo(lead.createdAt)}</span>
          </div>

          {lead.nextActionAt && (
            <p className="mt-3 inline-flex items-center gap-2 border-l-2 border-ember bg-ember/8 px-3 py-2 text-xs leading-5 ink-2">
              <CalendarClock size={14} className="shrink-0 text-ember" aria-hidden="true" />
              Follow-up was due {timeAgo(lead.nextActionAt)}
            </p>
          )}
        </header>

        {/* message */}
        <section className="mt-6 border-t border-ink/12 pt-5">
          <h2 className="stamp ink-3">Message</h2>
          <p className="mt-2 text-[15px] leading-7 text-ink">{lead.message}</p>
        </section>

        {/* consent */}
        <section className="mt-6 border-t border-ink/12 pt-5">
          <h2 className="stamp ink-3 flex items-center gap-1.5">
            <ShieldCheck size={13} aria-hidden="true" /> Consent on file
          </h2>
          <p className="ink-2 mt-2 text-xs leading-5">{lead.consentText}</p>
          <p className="stamp mt-2 ink-3">class · {lead.consentClass}</p>
        </section>

        {/* contact */}
        <section className="mt-6 border-t border-ink/12 pt-5">
          <h2 className="stamp ink-3 flex items-center gap-1.5">
            <Phone size={13} aria-hidden="true" /> Contact
          </h2>
          {revealedNumber ? (
            <p className="mt-2 font-mono text-base text-ink">{revealedNumber}</p>
          ) : (
            <p className="mt-2 flex items-center gap-2 font-mono text-base ink-2">
              {planLocked && <Lock size={14} className="shrink-0 text-ember" aria-hidden="true" />}
              {lead.phoneMasked}
            </p>
          )}
          <p className="ink-3 mt-1.5 text-xs leading-5">
            {attemptsLeft > 0
              ? `${attemptsLeft} of ${maxAttempts} call attempts left today`
              : "Attempt limit reached — log a result for the last call to continue."}
          </p>
        </section>

        {/* history */}
        <section className="mt-6 border-t border-ink/12 pt-5 pb-6">
          <h2 className="stamp ink-3">Trail</h2>
          <ol className="mt-3 space-y-2.5">
            {[...lead.history, ...loggedOutcomes.map((outcome, index) => ({ action: `call.${outcome.toLowerCase()}`, at: new Date().toISOString(), key: index }))].map(
              (entry, index) => (
                <li key={`${entry.action}-${index}`} className="flex items-baseline justify-between gap-3 border-l-2 border-ink/12 pl-3">
                  <span className="font-mono text-xs ink-2">{entry.action}</span>
                  <span className="stamp shrink-0 ink-3">{timeAgo(entry.at)}</span>
                </li>
              ),
            )}
          </ol>
        </section>
      </div>

      {/* ---------- thumb-anchored action bar ---------- */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink/12 bg-paper/96 backdrop-blur-md">
        <div className="container flex items-center gap-2 pt-2.5">
          <a
            ref={callAnchorRef}
            href={revealedNumber ? telLink(revealedNumber) : undefined}
            onClick={(event) => {
              if (revealedNumber) return; // let the href dial
              event.preventDefault();
              void onCallTap();
            }}
            aria-disabled={!gate.ok && !revealedNumber}
            className={`clay-fill touch-44 flex min-h-[56px] flex-1 items-center justify-center gap-2.5 px-5 stamp font-semibold ${
              gate.ok || revealedNumber ? "btn-sweep bg-brick text-cream" : "border border-ink/20 bg-sand ink-2"
            }`}
          >
            {revealing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" aria-hidden="true" />
            ) : planLocked && !revealedNumber ? (
              <Lock size={16} aria-hidden="true" />
            ) : (
              <Phone size={16} aria-hidden="true" />
            )}
            {revealedNumber
              ? "Call again"
              : revealing
                ? "Revealing…"
                : planLocked
                  ? "Plan needed to call"
                  : !gate.ok
                    ? blockedCopy?.title ?? "Cannot call"
                    : "Call now"}
          </a>

          <a
            href={revealedNumber ? waMeLink(revealedNumber) : undefined}
            onClick={(event) => {
              if (!revealedNumber) {
                event.preventDefault();
                void onCallTap();
              }
            }}
            target="_blank"
            rel="noreferrer"
            className="touch-44 grid h-[56px] w-[56px] shrink-0 place-items-center border border-trust/35 text-trust"
            aria-label="Open WhatsApp with this buyer"
          >
            <MessageCircle size={20} />
          </a>

          <button
            type="button"
            onClick={() => {
              setSheetAutoOpened(false);
              setSheetOpen(true);
            }}
            className="touch-44 grid h-[56px] w-[56px] shrink-0 place-items-center border border-ink/18 ink-2"
            aria-label="Log a call result manually"
            title="Log a call result"
          >
            <CheckCheck size={20} />
          </button>
        </div>
      </div>

      {/* blocked-state explanation — never leave a dead button unexplained */}
      {!gate.ok && blockedCopy && (
        <div className="fixed inset-x-0 bottom-[88px] z-30 px-3">
          <div className="container border-l-2 border-ember bg-card px-4 py-3 shadow-lg shadow-ink/5">
            <p className="text-sm font-medium leading-5 text-ink">{blockedCopy.title}</p>
            <p className="ink-2 mt-1 text-xs leading-5">{blockedCopy.body}</p>
            {blockedCopy.cta && (
              <Link href="/broker/onboarding/" className="touch-44 mt-2.5 inline-flex items-center gap-1.5 stamp font-semibold text-brick underline underline-offset-4">
                {blockedCopy.cta}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ---------- prototype controls ---------- */}
      <div className="container pb-8">
        <button
          type="button"
          onClick={() => setShowPrototypePanel((open) => !open)}
          className="touch-44 inline-flex items-center gap-2 stamp font-semibold text-brick underline underline-offset-4"
          aria-expanded={showPrototypePanel}
        >
          <FlaskConical size={13} aria-hidden="true" /> Prototype controls
        </button>

        {showPrototypePanel && (
          <div className="mt-3 border border-dashed border-ember/50 bg-ember/5 p-4">
            <p className="ink-2 text-xs leading-5">
              Not part of the product. These stand in for the real plan entitlement and server clock so every blocked state can be
              reviewed on a phone before the API exists.
            </p>

            <p className="stamp mt-4 ink-3">Broker plan</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["ACTIVE", "TRIAL", "EXPIRED", "NONE"] as BrokerPlanStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setPlanStatus(status);
                    setRevealedNumber(null);
                  }}
                  className={`touch-44 border px-3 py-2 stamp font-semibold ${
                    planStatus === status ? "border-brick bg-brick text-cream" : "border-ink/18 ink-2"
                  }`}
                >
                  {status.toLowerCase()}
                </button>
              ))}
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={simulateClosedHours}
                onChange={(event) => {
                  setSimulateClosedHours(event.target.checked);
                  setRevealedNumber(null);
                }}
                className="h-4 w-4 accent-[var(--brick)]"
              />
              <span className="text-sm ink-2">Simulate outside calling hours (09:00–20:00 IST)</span>
            </label>

            <p className="stamp mt-4 ink-3">Try each lead state</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROTOTYPE_LEADS.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => router.push(`/broker/leads/${candidate.id}/`)}
                  className={`touch-44 border px-3 py-2 stamp font-semibold ${
                    candidate.id === lead.id ? "border-brick bg-brick text-cream" : "border-ink/18 ink-2"
                  }`}
                >
                  {candidate.suppressed ? "suppressed" : !candidate.contactStored ? "not stored" : candidate.callAttempts >= candidate.maxAttempts ? "limit" : candidate.grade}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <CallResultSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        leadName={lead.name}
        stageBefore={stage}
        autoOpened={sheetAutoOpened}
        onLog={onLogged}
      />
    </div>
  );
}

/** Local mirror of OUTCOME_RULES[*].suppressesContact so this file does not
    import the whole rule table just for one boolean. */
const OUTCOME_SUPPRESSES: Partial<Record<CallOutcome, true>> = {
  NOT_INTERESTED: true,
  WRONG_OR_INVALID_NUMBER: true,
};

"use client";
/* Broker lead detail — the mobile calling surface.

   WHY A DETAIL ROUTE AND NOT AN EXPANDING LIST ROW
   There was no lead detail page at all (`find app -path '*leads*' -name
   page.tsx` returned only the list). Calling from a list row means the action
   bar competes with every other row's actions for thumb space, and there is
   nothing to deep-link a notification to. A full-screen lead with the dialer
   anchored to the bottom edge is the shape that works one-handed.

   THE REVEAL ROUND-TRIP
   The Call control is not an `<a href="tel:…">` on first paint, because the
   number is not in the payload — `GET /api/broker/leads` stays masked-only by
   design. The first tap posts to POST /api/broker/leads/[id]/reveal; the
   SERVER is the only gate authority (plan, consent, suppression, stored
   number, attempts, IST hours) and its reason copy is what this page surfaces
   — the client never re-derives the gate. On success the anchor gains its
   href and the dialer opens in the same gesture. Every later tap is a single
   action. On failure the button explains itself instead of going dead. */

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCheck, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import LoadingSkeleton from "@/components/architech/LoadingSkeleton";
import StatusBadge from "@/components/architech/StatusBadge";
import useTitle from "@/hooks/useTitle";
import { LEAD_STAGE_LABELS, type CallOutcome, type LeadStage } from "@/lib/leads/calling";
import type { LeadDetailRecord } from "@/lib/leads/lead";

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

export default function BrokerLeadDetail({ leadId }: { leadId: string }) {
  useTitle("Lead · broker desk");

  /* ---- real data (spec §8): the page reads what the gate read ---- */
  const [lead, setLead] = useState<LeadDetailRecord | null>(null);
  const [loadError, setLoadError] = useState<401 | 403 | 404 | null>(null);
  const [loading, setLoading] = useState(true);

  const [revealed, setRevealed] = useState<{ telLink: string; waMeLink: string } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAutoOpened, setSheetAutoOpened] = useState(false);

  const dialingRef = useRef(false);
  const callAnchorRef = useRef<HTMLAnchorElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/broker/leads/${encodeURIComponent(leadId)}`, { cache: "no-store" });
      if (response.status === 404) {
        setLoadError(404);
        return;
      }
      if (!response.ok) {
        setLoadError(response.status as 401 | 403);
        return;
      }
      const payload = (await response.json()) as { ok: boolean; lead: LeadDetailRecord };
      if (payload.ok) setLead(payload.lead);
    } catch {
      setLoadError(404);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function onCallTap() {
    if (revealed || revealing) return; // the anchor's own href handles the dial
    setRevealing(true);
    try {
      const response = await fetch(`/api/broker/leads/${encodeURIComponent(leadId)}/reveal`, { method: "POST" });
      const payload = (await response.json()) as { ok: boolean; telLink?: string; waMeLink?: string; errors?: string[] };
      if (!payload.ok || !payload.telLink) {
        /* Never a dead button: the server's reason copy is the copy. */
        toast("Cannot call this lead yet", { description: payload.errors?.[0] ?? "This number cannot be revealed right now." });
        return;
      }
      setRevealed({ telLink: payload.telLink, waMeLink: payload.waMeLink ?? "" });
      dialingRef.current = true;
      /* Same imperative href-before-navigate the surface established:
         React has not re-rendered, and a top-level location.assign("tel:…")
         inside the gesture continuation is what opens the dialer on iOS
         Safari and Chrome for Android. */
      if (callAnchorRef.current) callAnchorRef.current.href = payload.telLink;
      window.location.assign(payload.telLink);
    } finally {
      setRevealing(false);
    }
  }

  async function onLogged(logged: { outcome: CallOutcome; stageAfter: LeadStage; nextActionAt: string | null; lostReason: string | null; note: string | null }) {
    setSheetOpen(false);
    setSheetAutoOpened(false);
    const response = await fetch(`/api/broker/leads/${encodeURIComponent(leadId)}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: logged.outcome, nextActionAt: logged.nextActionAt, lostReason: logged.lostReason ?? undefined, note: logged.note ?? undefined }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { errors?: string[] } | null;
      toast("Could not record the call result", { description: payload?.errors?.[0] });
      return;
    }
    toast("Call result recorded.");
    await load(); // stage, attempts, suppression and the follow-up banner refresh
  }

  if (loading) {
    return (
      <div className="bg-paper pb-[104px] pt-[78px] text-ink">
        <div className="container space-y-5 py-4">
          <LoadingSkeleton className="h-5 w-24" label="Loading lead" />
          <div className="flex items-start gap-4">
            <LoadingSkeleton className="h-14 w-14 rounded-full" label="Loading lead" />
            <div className="flex-1 space-y-2">
              <LoadingSkeleton className="h-6 w-48" label="Loading lead" />
              <LoadingSkeleton className="h-4 w-32" label="Loading lead" />
            </div>
          </div>
          <LoadingSkeleton className="h-28 w-full" label="Loading lead" />
          <LoadingSkeleton className="h-40 w-full" label="Loading lead" />
        </div>
      </div>
    );
  }

  if (loadError || !lead) {
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

  const attemptsLeft = Math.max(0, lead.maxAttempts - lead.callAttempts);

  return (
    <div className="bg-paper pb-[104px] pt-[78px] text-ink">
      <div className="container">
        {/* back row */}
        <div className="flex items-center justify-between gap-3 py-4">
          <Link href="/broker/leads/" className="touch-44 inline-flex items-center gap-2 stamp font-semibold text-brick">
            <ArrowLeft size={15} /> Inbox
          </Link>
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
                {lead.listingId} · {lead.organizationName}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge tone={lead.status === "NEW" ? "ember" : "neutral"}>{lead.status.toLowerCase()}</StatusBadge>
            <span className="status-badge status-badge-trust stamp font-semibold">{LEAD_STAGE_LABELS[lead.stage as LeadStage] ?? lead.stage}</span>
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
          <p className="mt-2 font-mono text-base text-ink">{lead.phoneMasked}</p>
          <p className="ink-3 mt-1.5 text-xs leading-5">
            {lead.suppressed
              ? "On the do-not-call list — dialling from Architech is disabled for this number."
              : revealed
                ? "Number revealed to this device. Use it only for this enquiry."
                : attemptsLeft > 0
                  ? `${attemptsLeft} of ${lead.maxAttempts} call attempts left`
                  : "Attempt limit reached — log a result for the last call to continue."}
          </p>
        </section>

        {/* history */}
        <section className="mt-6 border-t border-ink/12 pt-5 pb-6">
          <h2 className="stamp ink-3">Trail</h2>
          {lead.callHistory.length === 0 ? (
            <p className="ink-3 mt-3 text-xs leading-5">No calls logged yet.</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {lead.callHistory.map((entry, index) => (
                <li key={`${entry.outcome}-${index}`} className="flex items-baseline justify-between gap-3 border-l-2 border-ink/12 pl-3">
                  <span className="font-mono text-xs ink-2">call.{entry.outcome.toLowerCase().replace(/_/g, "-")}</span>
                  <span className="stamp shrink-0 ink-3">{timeAgo(entry.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ---------- thumb-anchored action bar ---------- */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink/12 bg-paper/96 backdrop-blur-md">
        <div className="container flex items-center gap-2 pt-2.5">
          <a
            ref={callAnchorRef}
            href={revealed?.telLink}
            onClick={(event) => {
              if (revealed) return; // let the href dial
              event.preventDefault();
              void onCallTap();
            }}
            aria-disabled={revealing}
            aria-busy={revealing || undefined}
            className={`clay-fill touch-44 flex min-h-[56px] flex-1 items-center justify-center gap-2.5 px-5 stamp font-semibold ${
              revealed ? "btn-sweep bg-brick text-cream" : "border border-ink/20 bg-sand ink-2"
            }`}
          >
            {revealing ? (
              /* Spinner tint follows the button state: cream on the revealed
                 brick fill, brick on the sand "revealing" state. */
              <span className={`h-4 w-4 animate-spin rounded-full border-2 ${revealed ? "border-cream/40 border-t-cream" : "border-ink/25 border-t-brick"}`} aria-hidden="true" />
            ) : (
              <Phone size={16} aria-hidden="true" />
            )}
            {revealed ? "Call again" : revealing ? "Revealing…" : "Call now"}
          </a>

          <a
            href={revealed?.waMeLink}
            onClick={(event) => {
              if (!revealed) {
                event.preventDefault();
                void onCallTap();
              }
            }}
            aria-disabled={!revealed}
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

      <CallResultSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        leadName={lead.name}
        stageBefore={lead.stage as LeadStage}
        autoOpened={sheetAutoOpened}
        onLog={onLogged}
      />
    </div>
  );
}

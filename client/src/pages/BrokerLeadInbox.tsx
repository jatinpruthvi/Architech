"use client";
/* Broker lead inbox — reads the masked lead contract and advances statuses.
   Contact stays masked until the buyer chooses to share it; every status
   change is audited through the lead server adapter. */
import { CheckCheck, Inbox, MessageCircle, Phone, ShieldOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { LeadRecord, LeadStatus } from "@/lib/leads/lead";
import { leadGradeLabel, scoreLead } from "@/lib/leads/scoring";
import useTitle from "@/hooks/useTitle";
import EmptyState from "@/components/architech/EmptyState";
import LoadingSkeleton from "@/components/architech/LoadingSkeleton";
import StatusBadge from "@/components/architech/StatusBadge";

type ReplyAction = Exclude<LeadStatus, "NEW" | "DELETED">;

const ACTION_LABELS: Record<ReplyAction, string> = {
  ACKNOWLEDGED: "Acknowledge",
  REPLIED: "Mark replied",
  CLOSED: "Close",
};

function StatusPill({ status }: { status: LeadStatus }) {
  const tone = status === "NEW" ? "ember" : status === "REPLIED" ? "trust" : "neutral";
  return <StatusBadge tone={tone}>{status.toLowerCase()}</StatusBadge>;
}

function ScoreBadge({ lead }: { lead: LeadRecord }) {
  const scored = scoreLead(lead);
  const tone = scored.grade === "hot" ? "ember" : scored.grade === "warm" ? "trust" : "neutral";
  return <StatusBadge tone={tone}><span title={scored.signals.join(" · ")}>{leadGradeLabel(scored.grade)} · {scored.score}</span></StatusBadge>;
}

export default function BrokerLeadInbox() {
  useTitle("Lead inbox");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/broker/leads", { cache: "no-store" });
      const payload = await response.json();
      setLeads(Array.isArray(payload.leads) ? payload.leads : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async (id: string, status: ReplyAction) => {
    const response = await fetch(`/api/broker/leads/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      toast(payload.errors?.join(" ") ?? "Could not update the lead.", { description: "Please try again." });
      return;
    }
    setLeads((current) => current.map((lead) => (lead.id === id ? payload.lead : lead)));
    toast(`Lead ${status.toLowerCase()}.`, { description: "The status change was recorded." });
  };

  const removeLead = async (id: string, mode: "consent" | "delete") => {
    const response = await fetch(`/api/broker/leads/${encodeURIComponent(id)}?mode=${mode}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      toast(payload.errors?.join(" ") ?? "Could not remove the lead.", { description: "Please try again." });
      return;
    }
    setLeads((current) => current.filter((lead) => lead.id !== id));
    toast(mode === "consent" ? "Buyer consent revoked." : "Lead removed.", { description: "The action was recorded in the audit trail." });
  };

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Broker operations · Masked lead inbox</p>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,80px)]">Reach buyers without <em className="text-brick">burning their number</em>.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">Enquiries land here with the phone masked, consent on file, and every status change audited.</p>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-medium tracking-[-0.02em]">Inbox <span className="text-brick">{leads.length}</span></h2>
          <button onClick={() => void load()} className="stamp !text-[11px] font-semibold text-brick underline underline-offset-4">Refresh</button>
        </div>

        {loading && <div className="mt-8 space-y-4" role="status" aria-label="Loading enquiries"><LoadingSkeleton className="h-32 w-full" /><LoadingSkeleton className="h-32 w-full" /><span className="sr-only">Loading enquiries…</span></div>}
        {!loading && leads.length === 0 && (
          <div className="mt-10"><EmptyState eyebrow="Masked lead inbox" title="No enquiries yet" description="New enquiries from the listing page will appear here with masked contact details and consent history." icon={<Inbox size={28} />} /></div>
        )}

        <div className="mt-8 space-y-4">
          {leads.map((lead) => (
            <article key={lead.id} className="border border-ink/15 bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Whole identity block is the link to the detail route, so a
                    thumb can open the lead from anywhere in the top-left rather
                    than hunting a small chevron. `touch-44` keeps it a real
                    target. Reveal never happens from the list: scrolling an
                    inbox must not write a trail of reveals nobody acted on. */}
                <Link href={`/broker/leads/${encodeURIComponent(lead.id)}/`} className="touch-44 flex min-w-0 flex-1 items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-t-full bg-night font-display text-lg text-cream" aria-hidden="true">{lead.name.charAt(0)}</span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-medium leading-tight text-ink">{lead.name}</span>
                    <span className="stamp ink-3 mt-0.5 block truncate">{lead.listingTitle} · {lead.listingId}</span>
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  <ScoreBadge lead={lead} />
                  <StatusPill status={lead.status} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="border-l-2 border-brick pl-4">
                  <p className="stamp !text-[9px] text-ink/55 flex items-center gap-1.5"><Phone size={11} /> Masked contact</p>
                  <p className="mt-1 font-mono text-sm text-ink/80">{lead.phoneMasked}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="stamp !text-[9px] text-ink/55">Message</p>
                  <p className="mt-1 text-sm leading-6 text-ink/80">{lead.message}</p>
                </div>
              </div>

              <p className="stamp mt-4 !text-[9px] text-ink/55">Consent: {lead.consentText}</p>

              <div className="mt-5 flex flex-wrap gap-3 border-t border-ink/12 pt-5">
                {/* Primary action on mobile: the broker's whole job from an
                    inbox row is to call. It routes to the detail surface, which
                    owns the reveal gate, the plan check and the post-call
                    result sheet — deliberately NOT a `tel:` link here, because
                    the number is not in this payload and must not be. */}
                <Link
                  href={`/broker/leads/${encodeURIComponent(lead.id)}/`}
                  className="btn-sweep btn-solid clay-fill touch-44 inline-flex items-center gap-2 bg-brick px-4 py-2 stamp font-semibold text-cream"
                >
                  <Phone size={13} aria-hidden="true" /> Call
                </Link>
                {(["ACKNOWLEDGED", "REPLIED", "CLOSED"] as ReplyAction[]).map((action) => (
                  <button
                    key={action}
                    onClick={() => void advance(lead.id, action)}
                    disabled={lead.status === action}
                    className="btn-sweep btn-solid touch-44 px-4 py-2 stamp !text-[10px] font-semibold text-cream disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      {action === "REPLIED" ? <MessageCircle size={12} /> : action === "CLOSED" ? <CheckCheck size={12} /> : null}
                      {ACTION_LABELS[action]}
                    </span>
                  </button>
                ))}
                <span aria-hidden="true" className="mx-1 hidden self-center border-l border-ink/15 sm:block" />
                <button
                  onClick={() => void removeLead(lead.id, "consent")}
                  className="touch-44 inline-flex items-center gap-1.5 px-3 py-2 stamp !text-[10px] font-semibold text-ink/60 hover:text-brick"
                  title="Revoke buyer consent (privacy/right to be forgotten)"
                >
                  <ShieldOff size={12} /> Revoke consent
                </button>
                <button
                  onClick={() => void removeLead(lead.id, "delete")}
                  className="touch-44 inline-flex items-center gap-1.5 px-3 py-2 stamp !text-[10px] font-semibold text-ink/60 hover:text-brick"
                  title="Remove this lead"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

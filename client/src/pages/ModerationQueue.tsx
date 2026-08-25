"use client";
/* Live moderator queue. Reads drafts from the persistence store via the
   moderation API and posts approve / request-changes / reject decisions with a
   reason, so the whole draft → review → active lifecycle is audited. */
import { CheckCircle2, ClipboardList, MapPin, ShieldQuestion, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ListingDraft, ModerationDecision } from "@/lib/broker/workflow";
import useTitle from "@/hooks/useTitle";

const DECISIONS: { value: ModerationDecision; label: string }[] = [
  { value: "approve", label: "Approve" },
  { value: "request_changes", label: "Request changes" },
  { value: "reject", label: "Reject" },
];

function priceLabel(priceInr: number): string {
  if (priceInr >= 1_000_0000) return `₹${(priceInr / 1_000_0000).toFixed(2)} Cr`;
  return `₹${(priceInr / 1_0_0000).toFixed(1)} L`;
}

export default function ModerationQueue() {
  useTitle("Listing moderation");
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/moderation/listings", { cache: "no-store" });
      const payload = await response.json();
      setDrafts(Array.isArray(payload.drafts) ? payload.drafts : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (draftId: string, decision: ModerationDecision) => {
    const reason = reasons[draftId]?.trim();
    if (decision !== "approve" && (!reason || reason.length < 8)) {
      toast("A reason is required.", { description: "Explain the change requested or rejection." });
      return;
    }
    const response = await fetch(`/api/admin/moderation/listings/${encodeURIComponent(draftId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason: reason || "Facts verified against source." }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      toast(payload.errors?.join(" ") ?? "Could not update the draft.", { description: "Please try again." });
      return;
    }
    setDrafts((current) => current.filter((d) => d.id !== draftId));
    toast(`Listing ${decision.replace("_", " ")}.`, { description: "The decision was recorded in the audit trail." });
  };

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Moderator queue · source trail review</p>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,78px)]">Approve only what can be <em className="text-brick">proven</em>.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">Every submission is read from the persistence store. Approve, request changes, or reject — each decision is audited.</p>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-medium tracking-[-0.02em]">In review <span className="text-brick">{drafts.length}</span></h2>
          <button onClick={() => void load()} className="stamp !text-[11px] font-semibold text-brick underline underline-offset-4">Refresh</button>
        </div>

        {loading && <p className="mt-8 text-sm text-ink/60">Loading the queue…</p>}
        {!loading && drafts.length === 0 && (
          <div className="mt-10 border border-ink/15 bg-card p-10 text-center">
            <ClipboardList size={28} className="mx-auto text-ink/40" />
            <p className="mt-4 font-display text-xl font-medium">Queue is empty</p>
            <p className="mt-2 text-sm text-ink/60">Submitted drafts will appear here for source-trail review before publication.</p>
          </div>
        )}

        <div className="mt-8 space-y-5">
          {drafts.map((draft) => (
            <article key={draft.id} className="border border-ink/15 bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-medium tracking-[-0.02em]">{draft.title}</h3>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/60">
                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-brick" /> {draft.localitySlug}</span>
                    <strong className="font-display text-ink">{priceLabel(draft.priceInr)}</strong>
                    <span>{draft.bhk} BHK · {draft.areaSqft} sq ft</span>
                    <span>{draft.availability}</span>
                  </p>
                </div>
                <span className="stamp px-2 py-1 !text-[9px] font-semibold text-ember bg-ember/10">{draft.status.toLowerCase()}</span>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/70">{draft.description}</p>
              <p className="mt-3 stamp flex items-center gap-1.5 !text-[9px] text-ink/55"><ShieldQuestion size={11} /> RERA number {draft.mediaRightsConfirmed ? "" : "not yet "}· media rights {draft.mediaRightsConfirmed ? "confirmed" : "unconfirmed"}</p>

              <div className="mt-5 border-t border-ink/12 pt-5">
                <label className="stamp block !text-[10px] text-ink/55" htmlFor={`reason-${draft.id}`}>Reason (required unless approving)</label>
                <textarea
                  id={`reason-${draft.id}`}
                  value={reasons[draft.id] ?? ""}
                  onChange={(e) => setReasons((current) => ({ ...current, [draft.id]: e.target.value }))}
                  rows={2}
                  className="mt-1.5 w-full max-w-2xl border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-brick focus:outline-none"
                  placeholder="Cite the source or what needs changing…"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  {DECISIONS.map(({ value, label }) => (
                    <button key={value} onClick={() => void decide(draft.id, value)} className="btn-sweep touch-44 px-5 py-2.5 stamp !text-[11px] font-semibold text-cream">
                      <span className="flex items-center gap-2">
                        {value === "approve" ? <CheckCircle2 size={13} /> : value === "reject" ? <XCircle size={13} /> : null}
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

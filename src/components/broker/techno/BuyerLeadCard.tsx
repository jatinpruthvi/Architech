"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react";
import { waMeLink } from "@/lib/interop/phone";
import { BuyerLeadForm, type BuyerLeadView } from "./BuyerLeadForm";

const SOURCE_LABEL: Record<BuyerLeadView["source"], string> = {
  CALL: "Call",
  WALK_IN: "Walk-in",
  SOCIAL: "Social",
  REFERRAL: "Referral",
};

function bhkLabel(bhk: number | null): string | null {
  if (bhk == null) return null;
  return bhk === 4 ? "4BHK+" : `${bhk}BHK`;
}

function budgetLabel(lead: BuyerLeadView): string | null {
  if (lead.budgetValue == null) return null;
  const amount = lead.budgetValue.toLocaleString("en-IN");
  return lead.dealType === "RENT" ? `₹${amount}/mo` : `₹${amount}`;
}

function moveInLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `moves in ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

export function BuyerLeadCard({ lead, riseIndex }: { lead: BuyerLeadView; riseIndex: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    if (!window.confirm(`Delete ${lead.name}'s buyer lead? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/broker/technoproperty/buyer-leads/${lead.id}/`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      window.alert("Could not delete this lead. Try again.");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <article className="tp-card tp-card-accent" aria-label={`Edit ${lead.name}`}>
        <h3 className="tp-section-title !mb-3 text-lg">
          <Pencil size={16} aria-hidden="true" /> Edit {lead.name}
        </h3>
        <BuyerLeadForm
          initial={lead}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </article>
    );
  }

  const chips: { text: string; tone: string }[] = [
    { text: lead.dealType === "RENT" ? "Wants to rent" : "Wants to buy", tone: lead.dealType === "RENT" ? "tp-chip-blue" : "tp-chip-violet" },
  ];
  const bhk = bhkLabel(lead.bhk);
  if (bhk) chips.push({ text: bhk, tone: "tp-chip-green" });
  const budget = budgetLabel(lead);
  if (budget) chips.push({ text: budget, tone: "tp-chip-amber" });
  if (lead.area) chips.push({ text: lead.area, tone: "tp-chip-slate" });
  if (lead.furniture && lead.furniture !== "Any") chips.push({ text: lead.furniture, tone: "tp-chip-slate" });
  chips.push({ text: SOURCE_LABEL[lead.source] ?? lead.source, tone: "tp-chip-slate" });
  const moveIn = moveInLabel(lead.moveInAt);
  if (moveIn) chips.push({ text: moveIn, tone: "tp-chip-amber" });

  return (
    <article className="tp-card tp-rise" style={{ "--tp-i": Math.min(riseIndex, 11) } as CSSProperties}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-[var(--tp-ink)]">{lead.name}</p>
          {lead.phone ? (
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm">
              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-[var(--tp-accent)]">
                <Phone size={14} aria-hidden="true" />
                {lead.phone.replace("+91", "").replace(/^0/, "")}
              </a>
              <a
                href={waMeLink(lead.phone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--tp-accent-2)]"
                aria-label={`WhatsApp ${lead.name}`}
              >
                <MessageCircle size={14} aria-hidden="true" />
                WhatsApp
              </a>
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--tp-muted)]">…{lead.phoneLast4} (number unavailable)</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c.text} className={`tp-chip ${c.tone}`}>
                {c.text}
              </span>
            ))}
          </div>
          {lead.notes ? <p className="mt-2 text-xs text-[var(--tp-muted)]">Note: {lead.notes}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
          <Link href={`/broker/buyers/${lead.id}/matches`} className="tp-btn tp-btn-primary min-h-11">
            <Crosshair size={15} aria-hidden="true" /> Find matches
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="tp-action-btn"
              aria-label={`Edit ${lead.name}`}
              title="Edit"
              onClick={() => setEditing(true)}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              className="tp-action-btn"
              aria-label={`Delete ${lead.name}`}
              title="Delete"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

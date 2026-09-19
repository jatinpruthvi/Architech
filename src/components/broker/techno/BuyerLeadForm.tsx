"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

/* One lead as handed to client components (Dates as ISO strings). */
export interface BuyerLeadView {
  id: string;
  name: string;
  phone: string | null;
  phoneLast4: string;
  dealType: "RENT" | "SELL";
  bhk: number | null;
  budgetValue: number | null;
  area: string | null;
  furniture: string | null;
  moveInAt: string | null;
  source: "WALK_IN" | "CALL" | "SOCIAL" | "REFERRAL";
  notes: string | null;
  createdAt: string;
}

const FURNITURE_OPTIONS = ["Any", "Furnished", "Semi-furnished", "Unfurnished"] as const;
const SOURCE_OPTIONS: { value: BuyerLeadView["source"]; label: string }[] = [
  { value: "CALL", label: "Call" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "SOCIAL", label: "Social" },
  { value: "REFERRAL", label: "Referral" },
];

const ERROR_TEXT: Record<string, string> = {
  BUYER_LEAD_EMPTY_NAME: "Name is required.",
  INVALID_NAME: "Name is required.",
  INVALID_PHONE: "Enter a valid 10-digit Indian mobile number.",
  INVALID_DEAL_TYPE: "Pick Rent or Sell.",
  INVALID_BHK: "BHK must be between 1 and 4.",
  INVALID_BUDGET: "Budget must be a positive amount (max ₹10 crore).",
  INVALID_MOVE_IN: "Pick a valid move-in date.",
  INVALID_SOURCE: "Pick a valid source.",
};

export function BuyerLeadForm({
  initial,
  onDone,
}: {
  /** Set when editing; the form PUTs back to the same lead. */
  initial?: BuyerLeadView;
  onDone: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [dealType, setDealType] = useState<"RENT" | "SELL">(initial?.dealType ?? "RENT");
  const [bhk, setBhk] = useState(initial?.bhk ? String(initial.bhk) : "");
  const [budget, setBudget] = useState(initial?.budgetValue ? String(initial.budgetValue) : "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [furniture, setFurniture] = useState(initial?.furniture ?? "Any");
  const [moveIn, setMoveIn] = useState(initial?.moveInAt ? initial.moveInAt.slice(0, 10) : "");
  const [source, setSource] = useState<BuyerLeadView["source"]>(initial?.source ?? "CALL");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const isSell = dealType === "SELL";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const body = {
      name,
      phone,
      dealType,
      bhk: bhk === "" ? null : Number(bhk),
      budgetValue: budget === "" ? null : Number(budget),
      area: area || null,
      furniture,
      moveInAt: moveIn ? `${moveIn}T00:00:00.000Z` : null,
      source,
      notes: notes || null,
    };
    try {
      const res = await fetch(
        initial ? `/api/broker/technoproperty/buyer-leads/${initial.id}/` : "/api/broker/technoproperty/buyer-leads/",
        {
          method: initial ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(ERROR_TEXT[data?.error ?? ""] ?? "Could not save this lead. Try again.");
        return;
      }
      // Server refetch keeps chips/counts in sync; the form is one-shot.
      router.refresh();
      onDone();
    } catch {
      setError("Network error — your change was not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tp-form-grid gap-3" aria-busy={busy}>
      <div className="tp-field">
        <label htmlFor={`${id}-name`}>Name *</label>
        <input
          id={`${id}-name`}
          className="tp-input min-h-11"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Meera Shah"
          required
          maxLength={120}
          autoComplete="off"
        />
      </div>
      <div className="tp-field">
        <label htmlFor={`${id}-phone`}>Phone *</label>
        <input
          id={`${id}-phone`}
          className="tp-input min-h-11"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="10-digit mobile"
          required
          inputMode="tel"
          autoComplete="off"
        />
      </div>
      <div className="tp-field">
        <span className="text-[.78rem] font-semibold uppercase tracking-wide text-[var(--tp-ink-soft)]">Looking to</span>
        <div className="flex gap-2" role="group" aria-label="Looking to">
          <button
            type="button"
            className={`tp-tab min-h-11 ${!isSell ? "active" : ""}`}
            aria-pressed={!isSell}
            onClick={() => setDealType("RENT")}
          >
            Rent
          </button>
          <button
            type="button"
            className={`tp-tab min-h-11 ${isSell ? "active" : ""}`}
            aria-pressed={isSell}
            onClick={() => setDealType("SELL")}
          >
            Buy
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="tp-field">
          <label htmlFor={`${id}-bhk`}>BHK</label>
          <select id={`${id}-bhk`} className="tp-input min-h-11" value={bhk} onChange={(e) => setBhk(e.target.value)}>
            <option value="">Any</option>
            <option value="1">1BHK</option>
            <option value="2">2BHK</option>
            <option value="3">3BHK</option>
            <option value="4">4BHK+</option>
          </select>
        </div>
        <div className="tp-field">
          <label htmlFor={`${id}-budget`}>{isSell ? "Budget (₹ total)" : "Budget (₹/month)"}</label>
          <input
            id={`${id}-budget`}
            className="tp-input min-h-11"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder={isSell ? "e.g. 4500000" : "e.g. 25000"}
            inputMode="numeric"
            min={0}
          />
        </div>
      </div>
      <div className="tp-field">
        <label htmlFor={`${id}-area`}>Preferred area</label>
        <input
          id={`${id}-area`}
          className="tp-input min-h-11"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="e.g. Thaltej"
          maxLength={160}
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="tp-field">
          <label htmlFor={`${id}-furniture`}>Furniture</label>
          <select
            id={`${id}-furniture`}
            className="tp-input min-h-11"
            value={furniture}
            onChange={(e) => setFurniture(e.target.value)}
          >
            {FURNITURE_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="tp-field">
          <label htmlFor={`${id}-movein`}>Move-in by</label>
          <input
            id={`${id}-movein`}
            type="date"
            className="tp-input min-h-11"
            value={moveIn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setMoveIn(e.target.value)}
          />
        </div>
      </div>
      <div className="tp-field">
        <label htmlFor={`${id}-source`}>Source</label>
        <select
          id={`${id}-source`}
          className="tp-input min-h-11"
          value={source}
          onChange={(e) => setSource(e.target.value as BuyerLeadView["source"])}
        >
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="tp-field">
        <label htmlFor={`${id}-notes`}>Notes</label>
        <textarea
          id={`${id}-notes`}
          className="tp-input min-h-11"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the broker should remember"
          rows={2}
          maxLength={2000}
        />
      </div>
      {error ? (
        <p role="alert" className="tp-chip tp-chip-rose w-fit">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="tp-btn tp-btn-primary min-h-11" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          {initial ? "Save changes" : "Add buyer"}
        </button>
        <button type="button" className="tp-btn tp-btn-ghost min-h-11" onClick={onDone} disabled={busy}>
          <X size={16} aria-hidden="true" /> Cancel
        </button>
      </div>
    </form>
  );
}

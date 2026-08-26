"use client";
/* Buyer ownership-cost panel (decision dossier). Computes estimated monthly EMI,
   stamp duty, registration, and cash required from the listing price. Purely
   educational — assumes 80% LTV, 20y, 8.5% by default, all adjustable/labelled. */
import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import type { Property } from "@/lib/repositories";
import { calculateOwnershipCost, compactInr, type OwnershipAssumptions } from "@/lib/cost/ownership";
import { useLang } from "@/contexts/LangContext";

export function OwnershipCost({ property }: { property: Property }) {
  const { t } = useLang();
  const [cash, setCash] = useState<{ loanInr?: number; tenorYears?: number; annualRatePct?: number }>({});

  const assumptions: OwnershipAssumptions = useMemo(() => ({
    priceInr: property.priceNum,
    loanInr: cash.loanInr,
    tenorYears: cash.tenorYears,
    annualRatePct: cash.annualRatePct,
  }), [property.priceNum, cash]);

  const cost = useMemo(() => calculateOwnershipCost(assumptions), [assumptions]);

  const fieldCls = "mt-1.5 h-10 w-full rounded-lg border border-ink/20 bg-paper px-3 text-sm focus:border-brick focus:outline-none";

  return (
    <section aria-labelledby="ownership-cost-heading" className="mt-10 border border-ink/15 bg-card p-6 md:p-7">
      <div className="flex items-center gap-2">
        <Calculator size={18} className="text-brick" />
        <h3 id="ownership-cost-heading" className="kicker text-brick !text-[10px]">{t.listing.cost.kicker}</h3>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block text-xs text-ink/60"><span className="stamp !text-[10px]">{t.listing.cost.tenureLabel}</span>
          <input type="number" min={5} max={30} value={cash.tenorYears ?? 20} onChange={(e) => setCash((c) => ({ ...c, tenorYears: Number(e.target.value) }))} className={fieldCls} aria-label={t.listing.cost.tenureLabel} />
        </label>
        <label className="block text-xs text-ink/60"><span className="stamp !text-[10px]">{t.listing.cost.rateLabel}</span>
          <input type="number" min={5} max={15} step={0.1} value={cash.annualRatePct ?? 8.5} onChange={(e) => setCash((c) => ({ ...c, annualRatePct: Number(e.target.value) }))} className={fieldCls} aria-label={t.listing.cost.rateLabel} />
        </label>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-5 border-t border-ink/12 pt-5">
        <Stat label={t.listing.cost.monthlyLabel} value={`${compactInr(cost.monthlyEmiInr)}/mo`} accent />
        <Stat label={t.listing.cost.cashLabel} value={compactInr(cost.cashRequiredInr)} />
        <Stat label={t.listing.cost.stampLabel} value={compactInr(cost.stampDutyInr)} />
        <Stat label={t.listing.cost.registrationLabel} value={compactInr(cost.registrationInr)} />
      </dl>

      <p className="stamp mt-4 !text-[9px] text-ink/55">{t.listing.cost.note}</p>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="stamp !text-[9px] text-ink/55">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tracking-[-0.02em] ${accent ? "text-brick" : ""}`}>{value}</p>
    </div>
  );
}

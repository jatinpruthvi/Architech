"use client";
/* Buyer ownership-cost panel (decision dossier). Computes estimated monthly EMI,
   stamp duty, registration, and cash required from the listing price. Purely
   educational — assumes 80% LTV, 20y, 8.5% by default, all adjustable/labelled. */
import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import { getCityBySlug, type Property } from "@/lib/repositories";
import { calculateOwnershipCost, compactInr, type OwnershipAssumptions } from "@/lib/cost/ownership";
import { useLang } from "@/contexts/LangContext";

export function OwnershipCost({ property }: { property: Property }) {
  const { t } = useLang();
  const [cash, setCash] = useState<{ loanInr?: number; tenorYears?: number; annualRatePct?: number }>({});
  const state = getCityBySlug(property.citySlug)?.state;

  const assumptions: OwnershipAssumptions = useMemo(() => ({
    priceInr: property.priceNum,
    state,
    loanInr: cash.loanInr,
    tenorYears: cash.tenorYears,
    annualRatePct: cash.annualRatePct,
  }), [property.priceNum, state, cash]);

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
        <Stat label={t.listing.cost.cashLabel} value={cost.cashRequiredInr === null ? "Not available" : compactInr(cost.cashRequiredInr)} />
        <Stat label={t.listing.cost.stampLabel} value={cost.stampDutyInr === null ? "Not available" : compactInr(cost.stampDutyInr)} />
        <Stat label={t.listing.cost.registrationLabel} value={cost.registrationInr === null ? "Not available" : compactInr(cost.registrationInr)} />
      </dl>

      <div className="mt-4 border-l-2 border-ink/20 pl-3 text-[11px] leading-5 text-ink/60">
        <p>{cost.charges?.note ?? `Architech has no reviewed transfer-charge rule for ${state ?? "this listing's state"}. Statutory costs are withheld rather than estimated using another state's rates.`}</p>
        {cost.charges?.sourceUrl && <p className="mt-1"><a href={cost.charges.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-brick underline underline-offset-2">Official {cost.charges.state} registration service</a> · reviewed {cost.charges.reviewedAt}</p>}
        <p className="stamp mt-2 !text-[9px]">{t.listing.cost.note}</p>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="stamp !text-[9px] text-ink/55">{label}</dt>
      <dd className={`mt-1 font-display text-2xl font-semibold tracking-[-0.02em] ${accent ? "text-brick" : ""}`}>{value}</dd>
    </div>
  );
}

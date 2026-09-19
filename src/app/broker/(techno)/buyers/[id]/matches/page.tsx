import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crosshair, Sparkles } from "lucide-react";
import { requireTechnoSession } from "@/lib/technoproperty/session";
import { getBuyerLead, listMatchCandidates } from "@/lib/technoproperty/repository";
import { rankMatches, type MatchTier } from "@/lib/technoproperty/buyer-matching";
import { ContactRevealButton } from "@/components/broker/techno/ContactRevealButton";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

const TIER_META: Record<MatchTier, { label: string; chip: string }> = {
  strong: { label: "Strong", chip: "tp-chip-green" },
  good: { label: "Good", chip: "tp-chip-blue" },
  possible: { label: "Possible", chip: "tp-chip-amber" },
  low: { label: "Possible", chip: "tp-chip-amber" },
};

function money(value: number, perMonth: boolean): string {
  return `₹${value.toLocaleString("en-IN")}${perMonth ? "/mo" : ""}`;
}

function priceLabel(c: { rentPriceRaw: string | null; rentPriceValue: number | null }, perMonth: boolean): string | null {
  if (c.rentPriceValue != null) return money(c.rentPriceValue, perMonth);
  return c.rentPriceRaw;
}

const riseStyle = (i: number): CSSProperties => ({ "--tp-i": Math.min(i, 11) }) as CSSProperties;

export default async function BuyerMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;

  const lead = await getBuyerLead(orgId, userId, id);
  if (!lead) notFound();

  const perMonth = lead.dealType === "RENT";
  const candidates = await listMatchCandidates(orgId, lead.dealType);
  const ranked = rankMatches(
    {
      dealType: lead.dealType,
      bhk: lead.bhk,
      budgetValue: lead.budgetValue,
      area: lead.area,
      furniture: lead.furniture,
    },
    candidates.map((c) => ({
      id: c.id,
      category: c.category,
      keyInfo: c.keyInfo,
      availabilityRaw: c.availabilityRaw,
      area: c.area,
      rentPriceValue: c.rentPriceValue != null ? BigInt(c.rentPriceValue) : null,
      furnitureRaw: c.furnitureRaw,
      /* The candidate query already hard-excludes inactive/rented/sold. */
      active: true,
      isRentedOut: false,
      soldOut: false,
    })),
  );
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const bhkText = lead.bhk == null ? null : lead.bhk === 4 ? "4BHK+" : `${lead.bhk}BHK`;
  const budgetText =
    lead.budgetValue == null ? null : lead.budgetValue.toLocaleString("en-IN");
  const noRequirements = lead.bhk == null && lead.budgetValue == null && !lead.area;

  return (
    <div className="space-y-5">
      <Link href="/broker/buyers" className="tp-btn tp-btn-ghost min-h-11 !text-xs">
        <ArrowLeft size={14} aria-hidden="true" /> Back to buyer inventory
      </Link>

      {/* The buyer the matches are for — chips mirror the inventory card. */}
      <section className="tp-card tp-card-accent" aria-label="Buyer details">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-lg font-bold text-[var(--tp-ink)]">{lead.name}</h1>
          <span className="tp-chip tp-chip-slate">
            {lead.phone ? lead.phone.replace("+91", "").replace(/^0/, "") : `…${lead.phoneLast4}`}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="tp-chip tp-chip-blue">{perMonth ? "Wants to rent" : "Wants to buy"}</span>
          {bhkText ? <span className="tp-chip tp-chip-green">{bhkText}</span> : null}
          {budgetText ? (
            <span className="tp-chip tp-chip-amber">{perMonth ? `₹${budgetText}/mo` : `₹${budgetText}`}</span>
          ) : null}
          {lead.area ? <span className="tp-chip tp-chip-slate">{lead.area}</span> : null}
          {lead.furniture && lead.furniture !== "Any" ? (
            <span className="tp-chip tp-chip-slate">{lead.furniture}</span>
          ) : null}
        </div>
        {noRequirements ? (
          <p className="mt-3 text-xs font-semibold text-[var(--tp-muted)]">
            <Sparkles size={12} className="mr-1 inline" aria-hidden="true" />
            No requirements on file yet — these are your freshest active listings. Edit the lead to sharpen the
            match.
          </p>
        ) : null}
      </section>

      <section aria-label="Matched sellers">
        <h2 className="tp-section-title">
          <Crosshair size={18} aria-hidden="true" /> Best matches from today&rsquo;s inventory
          <span className="live">
            {ranked.length} {ranked.length === 1 ? "listing" : "listings"}
          </span>
        </h2>
        {ranked.length === 0 ? (
          <div className="tp-card tp-empty mt-3">
            <Crosshair size={26} className="mx-auto text-[var(--tp-muted)]" aria-hidden="true" />
            <p className="mt-2 font-semibold text-[var(--tp-ink)]">No active listings fit this buyer right now.</p>
            <p className="mt-1 text-sm text-[var(--tp-muted)]">
              Check the owner inventory, or loosen the budget or area on the lead.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {ranked.map((m, index) => {
              const c = byId.get(m.listingId);
              if (!c) return null;
              const tier = TIER_META[m.tier];
              const price = priceLabel(c, perMonth);
              const waContext = [c.keyInfo, c.area, price].filter(Boolean).join(", ") || null;
              return (
                <article key={c.id} className="tp-card tp-rise" style={riseStyle(index)}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-semibold text-[var(--tp-ink)]">
                          {c.premiseName || c.area || "Property"}
                        </p>
                        {c.isPremium ? <span className="tp-chip tp-chip-amber">Premium</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--tp-ink-soft)]">{c.address || c.area || "Address not listed"}</p>
                      <p className="mt-1 text-xs text-[var(--tp-muted)]">
                        {[c.keyInfo, price, c.daysAgo === 0 ? "New today" : c.daysAgo != null ? `${c.daysAgo}d old` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {m.reasons.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Why this listing matched">
                          {m.reasons.map((r) => (
                            <span key={r.text} className={`tp-chip ${r.ok ? "tp-chip-green" : "tp-chip-amber"}`}>
                              {r.text}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                      <span className={`tp-chip ${tier.chip}`}>
                        {tier.label} · {m.score}
                      </span>
                      <ContactRevealButton
                        propertyId={c.id}
                        initialName={c.ownerName}
                        initialPhone={c.ownerPhone}
                        initialPhoneLast4={c.ownerPhoneLast4}
                        waContext={waContext}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";
/* Locality intelligence — the provenance-labeled evidence band for the
   /buy/ahmedabad/:locality/ hub.

   Replaces promotional placeholder figures with facts derived only from
   structured listings, every one carrying the sample it came from. Bands:
     · price position (median, range, ₹/sq ft, "vs city") with an as-of label
     · inventory by configuration & budget
     · commute & nearby essentials (from measured landmarks)
     · new projects (from NEW_LAUNCH / UNDER_CONSTRUCTION listings)

   No figure is invented; where evidence is absent the band says so. */
import { ArrowUpRight, Building2, Check, Clock3, Route, Star, TrainFront } from "lucide-react";
import Link from "next/link";
import type { Locality } from "@/lib/repositories";
import type { LocalityIntel } from "@/lib/realestate/locality-intel";
import type { Property } from "@/lib/repositories";
import { compactInr, formatPsf } from "@/lib/realestate/locality-intel";
import { useLang } from "@/contexts/LangContext";
import PropertyCard from "./PropertyCard";
import Reveal from "./Reveal";

type Props = {
  intel: LocalityIntel;
  locality: Locality;
  newProjects: Property[];
};

const CATEGORY_LABEL: Record<string, string> = {
  transit: "Transit",
  health: "Health",
  learning: "Schools & learning",
  green: "Green",
  culture: "Culture",
  landmark: "Landmark",
};

export default function LocalityIntel({ intel, locality, newProjects }: Props) {
  const { t } = useLang();
  const name = locality.name;

  const localitySearchUrl = (filterIds: string[] = []) => {
    const p = new URLSearchParams();
    p.set("q", name);
    if (filterIds.length) p.set("filters", filterIds.join(","));
    return `/search?${p.toString()}`;
  };

  const bhkFilter = (bhk: number) => (bhk >= 3 ? ["3bhk"] : ["2bhk"]);
  const budgetFilter = (band: { min: number; max: number | null }) =>
    band.max !== null && band.max <= 15_000_000 ? ["under15"] : [];

  const delta = intel.position.deltaPct;
  const deltaLabel =
    delta === null || delta === 0
      ? t.intel.atPar
      : delta > 0
        ? t.intel.aboveCityPrefix.replace("{pct}", String(Math.abs(delta)))
        : t.intel.belowCityPrefix.replace("{pct}", String(Math.abs(delta)));

  return (
    <div className="space-y-16" aria-label={`${name} locality intelligence`}>
      {/* 1 · Price position + provenance */}
      <Reveal>
        <section className="border border-ink/15 bg-paper" aria-labelledby="intel-price-title">
          <div className="border-b border-ink/12 px-6 py-5 md:px-8">
            <p className="kicker text-brick !text-[10px]">{t.intel.priceKicker}</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <h2 id="intel-price-title" className="font-display text-3xl font-medium tracking-[-0.02em]">
                {name} — <span className="text-ink/40">{t.intel.pricePosition}</span>
              </h2>
              <p className="stamp !text-[10px] text-ink/55">
                {t.intel.basedOn.replace("{n}", String(intel.buyCount))} · {t.intel.updatedOn}{" "}
                {intel.asOfLabel}
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-[1fr_260px] md:p-8">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              <div>
                <dt className="stamp !text-[10px] text-ink/55">{t.intel.activeBuy}</dt>
                <dd className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-ink">
                  {intel.buyCount}
                </dd>
              </div>
              <div>
                <dt className="stamp !text-[10px] text-ink/55">{t.intel.medianAsking}</dt>
                <dd className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-ink">
                  {compactInr(intel.medianPriceInr)}
                </dd>
              </div>
              <div>
                <dt className="stamp !text-[10px] text-ink/55">{t.intel.avgPsf}</dt>
                <dd className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-ink">
                  {formatPsf(intel.avgPricePerSqftInr)}
                </dd>
              </div>
              <div>
                <dt className="stamp !text-[10px] text-ink/55">{t.intel.vsCity}</dt>
                <dd
                  className={`mt-2 font-display text-3xl font-semibold tracking-[-0.02em] ${
                    intel.position.deltaPct === null
                      ? "text-ink/50"
                      : intel.position.deltaPct >= 0
                        ? "text-brick"
                        : "text-trust"
                  }`}
                >
                  {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
                </dd>
              </div>
            </dl>

            {/* Price-position scale (decorative; the number above is the signal) */}
            <div className="border-t border-ink/10 pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <p className="stamp !text-[10px] text-ink/55">{deltaLabel}</p>
              <div
                className="relative mt-5 h-2 overflow-hidden rounded-full bg-ink/10"
                role="img"
                aria-label={`${name} median price per square foot is ${deltaLabel} ${t.intel.vsCity}`}
              >
                <span className="absolute left-1/2 top-0 h-full w-px bg-ink/25" aria-hidden="true" />
                <span
                  className={`absolute top-0 h-full rounded-full transition-all duration-500 motion-safe:animate-[none] ${
                    delta !== null && delta >= 0 ? "left-1/2 bg-brick" : "right-1/2 bg-trust"
                  }`}
                  style={{ width: `${Math.min(50, Math.abs(delta ?? 0))}%` }}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-4 flex items-center gap-2 stamp !text-[10px] text-ink/55">
                <Star size={12} className="text-ember" /> {t.intel.cityBaseline}
              </p>
            </div>
          </div>

          {intel.buyCount === 0 && (
            <p className="border-t border-ink/12 px-6 py-4 text-sm leading-6 text-ink/60 md:px-8">
              {t.intel.noBuyInventory}
            </p>
          )}
        </section>
      </Reveal>

      {/* 2 · Inventory by configuration & budget */}
      <Reveal>
        <section className="grid gap-6 lg:grid-cols-2" aria-labelledby="intel-config-title">
          <div className="border border-ink/15 bg-sand/45 p-6 md:p-8">
            <p className="kicker text-brick !text-[10px]">{t.intel.configKicker}</p>
            <h3 id="intel-config-title" className="mt-3 font-display text-2xl font-medium tracking-[-0.02em]">
              {t.intel.byConfiguration}
            </h3>
            {intel.byBhk.length > 0 ? (
              <ul className="mt-6 space-y-0">
                {intel.byBhk.map((band) => (
                  <li key={band.bhk} className="flex items-center justify-between border-b border-ink/10 py-3.5">
                    <span className="text-sm text-ink/75">{band.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="stamp !text-[11px] font-semibold text-ink">{band.count}</span>
                      <Link
                        href={localitySearchUrl(bhkFilter(band.bhk))}
                        className="touch-44 inline-flex items-center gap-1 stamp !text-[10px] font-semibold text-brick hover:underline"
                        aria-label={`${t.intel.viewConfig} ${band.label}`}
                      >
                        {t.intel.view} <ArrowUpRight size={12} />
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 border-t border-ink/10 pt-5 text-sm leading-6 text-ink/60">
                {t.intel.noConfigInventory}
              </p>
            )}
          </div>

          <div className="border border-ink/15 bg-sand/45 p-6 md:p-8">
            <p className="kicker text-ember !text-[10px]">{t.intel.budgetKicker}</p>
            <h3 className="mt-3 font-display text-2xl font-medium tracking-[-0.02em]">{t.intel.byBudget}</h3>
            {intel.byBudget.length > 0 ? (
              <ul className="mt-6 space-y-0">
                {intel.byBudget.map((band) => (
                  <li key={band.id} className="flex items-center justify-between border-b border-ink/10 py-3.5">
                    <span className="text-sm text-ink/75">{band.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="stamp !text-[11px] font-semibold text-ink">{band.count}</span>
                      <Link
                        href={localitySearchUrl(budgetFilter(band))}
                        className="touch-44 inline-flex items-center gap-1 stamp !text-[10px] font-semibold text-brick hover:underline"
                        aria-label={`${t.intel.viewBudget} ${band.label}`}
                      >
                        {t.intel.view} <ArrowUpRight size={12} />
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 border-t border-ink/10 pt-5 text-sm leading-6 text-ink/60">
                {t.intel.noBudgetInventory}
              </p>
            )}
          </div>
        </section>
      </Reveal>

      {/* 3 · Commute & nearby essentials */}
      <Reveal>
        <section className="grid gap-0 border border-ink/12 md:grid-cols-[1.25fr_0.75fr]" aria-labelledby="intel-commute-title">
          <div className="p-6 md:p-8">
            <p className="kicker text-brick !text-[10px]">{t.intel.commuteKicker}</p>
            <h3 id="intel-commute-title" className="mt-3 font-display text-2xl font-medium tracking-[-0.02em]">
              {t.intel.commuteTitle}
            </h3>
            {intel.commute.length > 0 ? (
              <ul className="mt-6 space-y-0">
                {intel.commute.map((stop) => (
                  <li key={stop.place} className="flex items-center justify-between border-b border-ink/10 py-3.5">
                    <span className="flex items-center gap-2.5 text-sm text-ink/75">
                      <Route size={14} className="shrink-0 text-ember" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate">{stop.place}</span>
                        <span className="stamp !text-[9px] text-ink/50">{CATEGORY_LABEL[stop.category] ?? "Landmark"}</span>
                      </span>
                    </span>
                    <span className="stamp !text-[11px] font-semibold text-brick">{stop.distance}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 border-t border-ink/10 pt-5 text-sm leading-6 text-ink/60">
                {t.intel.noLandmarks}
              </p>
            )}
          </div>
          <div className="flex flex-col justify-between border-t border-ink/12 bg-card p-6 md:border-l md:border-t-0 md:p-8">
            <div>
              <p className="stamp !text-[10px] text-ink/55">{t.intel.essentialsKicker}</p>
              <h4 className="mt-3 font-display text-lg font-medium tracking-[-0.02em]">{t.intel.essentialsTitle}</h4>
              <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-ink/65">
                <TrainFront size={16} className="mt-0.5 shrink-0 text-ember" aria-hidden="true" />
                {t.intel.essentialsCopy}
              </p>
              <p className="mt-4 flex items-start gap-2 stamp !text-[10px] text-ink/60">
                <Check size={13} className="mt-0.5 shrink-0 text-trust" aria-hidden="true" />
                {t.intel.essentialsHonest}
              </p>
            </div>
            <Link href="/guide" className="mt-6 inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-brick">
              {t.intel.readStudy} <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      </Reveal>

      {/* 4 · New projects */}
      <Reveal>
        <section aria-labelledby="intel-projects-title">
          <div className="flex flex-col justify-between gap-4 border-b border-ink/12 pb-4 sm:flex-row sm:items-end">
            <div>
              <p className="kicker text-trust !text-[10px]">{t.intel.projectsKicker}</p>
              <h3 id="intel-projects-title" className="mt-3 font-display text-2xl font-medium tracking-[-0.02em]">
                {t.intel.projectsTitle} {name}
              </h3>
            </div>
            <Link href={localitySearchUrl(["availability-new"])} className="group inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-brick">
              {t.intel.allNewProjects} <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Link>
          </div>
          {newProjects.length > 0 ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {newProjects.map((property, i) => (
                <PropertyCard key={property.id} property={property} index={i} />
              ))}
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-trust/10 text-trust">
                <Building2 size={22} />
              </span>
              <div>
                <p className="font-display text-xl font-medium tracking-[-0.015em]">{t.intel.noProjectsTitle}</p>
                <p className="mt-2 max-w-[640px] text-sm leading-6 text-ink/60">{t.intel.noProjectsCopy}</p>
                <p className="mt-3 flex items-center gap-2 stamp !text-[10px] text-ink/55">
                  <Clock3 size={12} className="text-ember" /> {t.intel.noProjectsNote}
                </p>
              </div>
            </div>
          )}
        </section>
      </Reveal>
    </div>
  );
}

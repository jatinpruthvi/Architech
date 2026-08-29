"use client";
/* ARCHITECH — Locality authority page, parameterized: /buy/:city/:locality/
   Real OSM coordinates & maps per locality; unknown slugs render 404.
   All city naming comes from the city registry, never a hardcoded city. */
import { ArrowUpRight, Check, Clock3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import PropertyCard from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import Pic from "../components/architech/Pic";
import LocalityIntel from "../components/architech/LocalityIntel";
import useTitle from "../hooks/useTitle";
import { DEFAULT_CITY_SLUG, getCityBySlug, getListingsByCity, getListingsByLocality, getLocalities, getLocalityBySlug } from "@/lib/repositories";
import { compactInr } from "@/lib/realestate/price-trends";
import { localityIntel, formatPsf } from "@/lib/realestate/locality-intel";
import { localityTrustSummary } from "@/lib/trust/locality";
import { useLang } from "@/contexts/LangContext";
import { fillTokens } from "@/lib/i18n";

export default function CityPage({ localitySlug, citySlug = DEFAULT_CITY_SLUG }: { localitySlug: string; citySlug?: string }) {
  const locality = getLocalityBySlug(localitySlug, citySlug);
  const city = getCityBySlug(locality?.citySlug ?? citySlug);
  const { t } = useLang();
  const cityLabel = city?.name ?? t.common.ahmedabad;
  useTitle(locality ? `${locality.name}, ${cityLabel} — homes & locality context` : "Not found");
  if (!locality || !city) return null;

  const isPaldi = locality.slug === "paldi";
  const cityHomes = getListingsByCity(city.slug);
  const localHomes = getListingsByLocality(locality.slug, city.slug);
  const showcase = localHomes.length ? [...localHomes, ...cityHomes.filter((p) => p.localitySlug !== locality.slug)].slice(0, 4) : cityHomes.slice(0, 4);
  const nearby = getLocalities(city.slug).filter((l) => l.slug !== locality.slug).slice(0, 4);

  const intel = localityIntel(locality.slug);
  const trust = localityTrustSummary(locality.slug, city.slug);
  const newProjects = localHomes.filter(
    (p) => p.availability === "NEW_LAUNCH" || p.availability === "UNDER_CONSTRUCTION",
  );
  const riverfrontKm = locality.landmarks?.find(([place]) => place.toLowerCase().includes("riverfront"))?.[1] ?? "—";

  return (
    <div className="bg-paper pt-[78px] text-ink">

      {/* Header band */}
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 stamp !text-[11px] text-ink/60" aria-label="Breadcrumb">
            <Link href="/" className="link-rail hover:text-brick">{t.locality.breadcrumbHome}</Link><span>/</span>
            <Link href={`/buy/${city.slug}/`} className="link-rail hover:text-brick">{fillTokens(t.locality.breadcrumbCity, { city: city.name })}</Link><span>/</span>
            <span className="text-ink/80">{locality.name}</span>
          </nav>
          <div className="mt-12 grid gap-12 md:grid-cols-[1.25fr_0.75fr] md:items-end">
            <div>
              <p className="kicker text-brick">{t.locality.kicker} · {locality.hindi}</p>
              <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">{locality.name}, <em className="text-brick">{city.name}</em></h1>
              <p className="mt-7 max-w-[560px] text-base leading-8 text-ink/65 md:text-lg">
                {locality.note}. {t.locality.introSuffix}
              </p>
              <p className="stamp mt-5 !text-[10px] text-ink/60">{locality.coords} · © OpenStreetMap contributors</p>
              {locality.pincodes.length > 0 && (
                /* A locality can serve several PINs, so all of them are stated
                   rather than picking one and implying it is the whole story. */
                <p className="stamp mt-2 !text-[10px] text-ink/60">
                  {t.locality.pincodeLabel} {locality.pincodes.join(" · ")}
                  <span className="ml-2 text-ink/45">{t.locality.pincodeNote}</span>
                </p>
              )}
            </div>
            <Reveal delay={100}>
              <div className="border-l-4 border-brick bg-paper p-6 editorial-shadow md:p-7">
                <p className="stamp !text-[10px] text-ink/60">{t.locality.snapshot} · {t.intel.updatedOn} {intel.asOfLabel}</p>
                <div className="mt-5 grid grid-cols-2 gap-6">
                  {[
                    [String(intel.buyCount), t.intel.activeBuy],
                    [formatPsf(intel.avgPricePerSqftInr), t.locality.medianRate],
                    [riverfrontKm, t.locality.toRiverfront],
                    [`${trust.reraCoveragePct}%`, t.locality.reraCoverage],
                  ].map(([n, l]) => (
                    <div key={l}><strong className="font-display text-[28px] font-medium tracking-[-0.02em]">{n}</strong><p className="stamp mt-1 !text-[10px] text-ink/60">{l}</p></div>
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-2 border-t border-ink/10 pt-4 stamp !text-[10px] text-trust"><Clock3 size={12} /> {t.locality.updatedSources}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Current price range · configuration/budget · commute · new projects — provenance-true */}
      <section className="container py-14 md:py-20">
        <Reveal>
          <LocalityIntel intel={intel} locality={locality} newProjects={newProjects} />
        </Reveal>
      </section>

      {/* Historical price trend (aggregate, buy listings only) */}
      <section className="container pb-14">
        <div className="grid gap-6 border border-ink/15 bg-paper p-6 md:grid-cols-4">
          <div className="border-l-4 border-brick pl-4 md:border-l-0 md:border-r md:border-ink/10 md:pl-0">
            <p className="stamp !text-[10px] text-ink/60">{t.intel.activeBuy}</p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">{intel.buyCount}</p>
          </div>
          <div className="border-l-4 border-brick pl-4">
            <p className="stamp !text-[10px] text-ink/60">Median price</p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">{compactInr(intel.medianPriceInr)}</p>
          </div>
          <div className="border-l-4 border-brick pl-4">
            <p className="stamp !text-[10px] text-ink/60">Price range</p>
            <p className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">{compactInr(intel.minPriceInr)} – {compactInr(intel.maxPriceInr)}</p>
          </div>
          <div className="border-l-4 border-brick pl-4">
            <p className="stamp !text-[10px] text-ink/60">Avg / sq ft</p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">{formatPsf(intel.avgPricePerSqftInr)}</p>
          </div>
        </div>
        <p className="stamp mt-2 !text-[9px] text-ink/55">{t.intel.basedOn.replace("{n}", String(intel.buyCount))} · {t.intel.updatedOn} {intel.asOfLabel}</p>
      </section>

      {/* Feel of the place */}
      <section className="container grid gap-14 py-20 md:grid-cols-[0.95fr_1.05fr] md:items-center md:py-28">
        <Reveal>
          <p className="kicker text-brick">{t.locality.feelKicker}</p>
          <h2 className="display mt-6 max-w-[480px] text-[clamp(30px,3.8vw,52px)]">{t.locality.feelTitle1} <em className="text-brick">{t.locality.feelTitleEm}</em>.</h2>
          <p className="mt-7 max-w-[460px] text-[15px] leading-7 text-ink/65">
            {isPaldi
              ? "Paldi balances a residential rhythm with a generous everyday life: walkable lanes, places to eat that aren't chains, and a strong mix of established homes and newer projects."
              : `${locality.name} — ${locality.note.toLowerCase()}. ${t.locality.fullStudySoon}`}
          </p>
          <ul role="list" className="mt-9 space-y-4 text-sm text-ink/75">
            {(isPaldi
              ? ["Walkable pockets around Law Garden and Tagore Hall", "Schools, cafes, and everyday retail within ten minutes", "A healthy mix of resale character and new RERA projects"]
              : ["Verified locality boundary and coordinates (OpenStreetMap)", "RERA-checked projects tracked as they register", "Full editorial study publishing soon"]).map((t) => (
              <li key={t} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-trust" /> {t}</li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-2">
            <span className="stamp mr-1 mt-2 !text-[10px] text-ink/60">{t.locality.nearby}</span>
            {nearby.map((n) => (
              <Link key={n.slug} href={`/buy/${city.slug}/${n.slug}/`} className="border border-ink/20 px-3.5 py-2 stamp !text-[11px] text-ink/75 transition-colors hover:border-brick hover:text-brick">{n.name}</Link>
            ))}
          </div>
        </Reveal>
        <Reveal delay={140}>
          <figure>
            <div className="arch-frame-sm img-hover grain editorial-shadow">
              <Pic name="locality-street" alt={`Tree-lined residential street in ${locality.name}, ${city.name}`} className="aspect-[4/3] w-full object-cover" sizes="(max-width: 768px) 100vw, 55vw" />
            </div>
            <figcaption className="mt-4 flex items-center justify-between stamp !text-[10px] text-ink/60"><span>{locality.name}, morning canopy</span><span>Study frame · Aug 2026</span></figcaption>
          </figure>
        </Reveal>
      </section>

      {/* Real OSM map + distances */}
      <section className="container pb-20 md:pb-28">
        <Reveal>
          <div className="grid gap-0 border border-ink/12 md:grid-cols-[1.3fr_0.7fr]">
            <div className="relative min-h-[380px] bg-sand">
              <iframe
                title={`Map of ${locality.name}, ${city.name} — OpenStreetMap`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(locality.bbox.split(",").join("%2C")).replace(/%2C/g, "%2C")}&layer=mapnik&marker=${locality.marker}`}
                className="map-frame absolute inset-0 h-full w-full border-0"
                loading="lazy"
              />
              <p className="stamp absolute right-3 top-3 bg-paper/90 px-2 py-1 !text-[9px] text-ink/60">© OpenStreetMap contributors</p>
            </div>
            <div className="bg-card p-7 md:p-9">
              <p className="kicker text-brick !text-[10px]">{t.locality.measured}</p>
              <h3 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">{t.locality.distancesFrom} {locality.name}</h3>
              {locality.landmarks ? (
                <div className="mt-6 space-y-0 border-t border-ink/12">
                  {locality.landmarks.map(([place, d]) => (
                    <div key={place} className="flex items-center justify-between border-b border-ink/12 py-3.5">
                      <span className="text-sm text-ink/75">{place}</span>
                      <span className="stamp !text-[11px] font-semibold text-brick">{d}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 border-t border-ink/12 pt-5 text-sm leading-6 text-ink/60">Verified landmark distances for {locality.name} are being measured by our field team — publishing with the full locality study.</p>
              )}
              <p className="stamp mt-5 !text-[9px] leading-4 text-ink/60">{t.locality.geodata}</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Homes */}
      <section className="border-y border-ink/12 bg-sand/60 py-20 md:py-28">
        <div className="container">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="kicker text-brick">{t.locality.homesIn} {locality.name}</p>
              <h2 className="display mt-6 text-[clamp(30px,3.8vw,52px)]">{t.locality.sourceTrailTitle} <em className="text-brick">{t.locality.sourceTrailEm}</em>.</h2>
            </div>
            <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">{t.locality.refine} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {showcase.map((property, i) => (
              <Reveal key={property.id} delay={i * 80}><PropertyCard property={property} index={i} /></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust note */}
      <section className="container py-20 md:py-24">
        <Reveal>
          <div className="grid gap-8 border border-ink/12 bg-card p-8 md:grid-cols-[auto_1fr_auto] md:items-center md:p-10">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-trust/10 text-trust"><ShieldCheck size={24} /></span>
            <div>
              <p className="font-display text-2xl font-medium tracking-[-0.015em]">{t.locality.trustTitlePrefix} {locality.name} {t.locality.trustTitleSuffix}</p>
              <p className="mt-2 max-w-[560px] text-sm leading-6 text-ink/60">{t.locality.trustCopy}</p>
            </div>
            <Link href="/guide" className="clay-fill btn-sweep motion-press inline-flex w-fit items-center gap-2 bg-brick px-6 py-4 stamp !text-[12px] font-semibold text-cream">{t.locality.verifyCta}</Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

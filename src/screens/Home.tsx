"use client";
/* ARCHITECH — Home v3 "Aurora Glass".
   Reference world: a luminous multi-colour aurora canvas with frosted glass
   panels floating on it. Hero rule: keep the centred search hierarchy, put it
   on one clean glass surface, and let the canvas carry the colour — no stacked
   gradient scrims, no glowing bloom, no photo card floating in the corner. */
import { ArrowUpRight, TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import PropertyCard from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import NumberTicker from "../components/magicui/NumberTicker";
import Pic from "../components/architech/Pic";
import HeroSearch, { type HeroPreset, type HeroSearchCity } from "../components/architech/HeroSearch";
import type { MarketLocalityLink, MarketProject } from "../components/architech/MarketDirectory";
import useTitle from "../hooks/useTitle";
import type { Property } from "@/lib/repositories";
import type { SearchSuggestion } from "@/lib/search/suggestion-types";
import { useLang } from "@/contexts/LangContext";

const MarketDirectory = dynamic(() => import("../components/architech/MarketDirectory"), { ssr: false });

export type HomeCity = HeroSearchCity & {
  hindi: string;
  state: string;
  coords: string;
  tagline: string;
  localityCount: number;
};

export type HomeProps = {
  featured: Property[];
  listingCount: number;
  localityCount: number;
  cityCount: number;
  cities: HomeCity[];
  popularSearches: SearchSuggestion[];
  heroPresets: HeroPreset[];
  example: string;
  marketProjects: MarketProject[];
  marketLocalityLinks: MarketLocalityLink[];
};

function faqsFor(cityCount: number, localityCount: number) {
  return [
    { q: "How does RERA verification work across India?", a: "The listing’s reviewed state or union territory selects the applicable authority. A badge requires an approved adapter and a matching registration, promoter, project, and status record; unsupported authorities remain visibly unverified and are never checked against Gujarat as a fallback." },
    { q: "What does the freshness stamp mean?", a: "In production it records when price, availability, and listing facts were last confirmed. Current concept-preview dates are deterministic demo data, not evidence that a live listing was re-checked." },
    { q: "Will brokers get my phone number?", a: "Requirement capture stores contact digits encrypted and displays only a masked number. Production partner access and explicit sharing remain gated until the consent and access-control workflow is approved." },
    { q: "Which cities do you cover?", a: `The concept registry currently demonstrates ${cityCount} Indian city markets — Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad, Gurugram, Noida, Surat and Jaipur — across ${localityCount} locality fixtures. Production coverage goes live city by city only after source and locality review.` },
  ];
}

export default function Home({
  featured,
  listingCount,
  localityCount,
  cityCount,
  cities,
  popularSearches,
  heroPresets,
  example,
  marketProjects,
  marketLocalityLinks,
}: HomeProps) {

  useTitle("");
  const { t } = useLang();
  return (
    /* No page-level background: the aurora canvas lives on body::before and has
       to show through every section for the glass to have anything to refract. */
    <div className="text-ink">

      {/* ================= HERO =================
           One canvas, one focal control. The old hero stacked nine layers (two
           radial gradients, a linear scrim, a warm wash, grain, an ember bloom,
           a glow sweep and a photograph) and ran two of them on infinite loops;
           the reference gets its depth from the canvas alone. */}
      <section className="relative min-h-[560px] overflow-hidden pb-16 pt-28 md:min-h-[620px] md:pb-24 md:pt-36">
        <div className="container">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <p className="kicker fade-rise text-brick" style={{ "--d": "120ms" } as React.CSSProperties}>India · locality-first discovery</p>
            <h1 className="display fade-rise mt-7 text-[clamp(40px,6.2vw,78px)] text-balance text-ink" style={{ "--d": "220ms" } as React.CSSProperties}>
              {t.hero.h1a}<em>{t.hero.h1em}</em>{" "}{t.hero.h1b}
            </h1>
            <p className="fade-rise mt-5 max-w-[560px] text-[15px] leading-7 text-ink/75 md:text-base" style={{ "--d": "340ms" } as React.CSSProperties}>
              {t.hero.sub}
            </p>
          </div>

          {/* The search IS the panel — no p-2 wrapper box around it (the old hero
              nested a padded container around the composer, boxing the single most
              important control on the site). */}
          <div className="search-spring-in mx-auto mt-10 w-full max-w-[760px]" style={{ "--d": "460ms" } as React.CSSProperties}>
            <HeroSearch cities={cities} popularSearches={popularSearches} heroPresets={heroPresets} example={example} />
          </div>

          {/* Real registry counts only. This block previously hardcoded
              `<NumberTicker value={100} suffix="%" />` under the label
              "RERA-checked" — a fabricated verification claim with no
              denominator, on a page whose own FAQ calls its dates demo data. */}
          <dl className="glass fade-rise mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-px overflow-hidden text-center sm:grid-cols-3" style={{ "--d": "620ms" } as React.CSSProperties}>
            {[
              { value: listingCount, label: t.hero.stats[0] },
              { value: localityCount, label: t.hero.stats[1] },
              { value: cityCount, label: t.hero.stats[2] },
            ].map((stat) => (
              <div key={stat.label} className="px-6 py-7">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  {/* `tabular-nums` + a reserved `min-w` keep the box the same size
                      while NumberTicker counts up from its server-rendered 0 to the
                      real value. Without it the digit count changes mid-animation and
                      re-centres this cell on every tick — a measurable layout shift
                      (reported CLS was 0.274 on `/`). */}
                  <span className="block font-display text-[34px] font-medium leading-none tracking-[-0.03em] tabular-nums text-ink">
                    <span className="inline-block min-w-[6ch]"><NumberTicker value={stat.value} /></span>
                  </span>
                  <span className="stamp-sm mt-3 block text-ink/75">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="fade-rise mt-5 text-center text-sm text-ink/75" style={{ "--d": "700ms" } as React.CSSProperties}>{t.hero.demoNote}</p>
        </div>
      </section>

      {/* ================= FEATURED HOMES ================= */}
      <section className="container py-20 md:py-28">
        <Reveal className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="kicker text-brick">{t.sections.curatedKicker}</p>
            <h2 className="display mt-7 max-w-[640px] text-[clamp(32px,4.2vw,56px)] text-balance">Homes worth <em>returning</em> to.</h2>
          </div>
          <Link href="/search" className="group inline-flex items-center gap-2 stamp font-semibold text-brick">{t.sections.all281Homes} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((property, i) => (
            <Reveal key={property.id} delay={i * 90}>
              {/* No 3D tilt: the reference gets depth from the canvas and the glass
                  edge, and a tilting card fought the flat frosted material. */}
              <PropertyCard property={property} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= MARKET DIRECTORY ================= */}
      <MarketDirectory projects={marketProjects} localityLinks={marketLocalityLinks} />

      {/* ================= CITY INDEX ================= */}
      <section className="py-20 md:py-28">
        <div className="container">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="kicker text-brick">{t.sections.localityKicker}</p>
              <h2 className="display mt-7 max-w-[680px] text-balance text-[clamp(32px,4.2vw,56px)]">{t.sections.localityTitle}</h2>
            </div>
            <p className="stamp-sm text-ink/75">Coordinates © OpenStreetMap contributors</p>
          </Reveal>
          {/* One glass panel holding ruled rows, rather than a bordered stack on a
              contour field. Rows are separated by hairlines, so the panel stays
              open instead of becoming a card-inside-a-card grid. */}
          <div className="glass mt-12 overflow-hidden">
            {cities.map((city, i) => (
              <Reveal key={city.slug} delay={i * 40}>
                <Link href={`/buy/${city.slug}/`} className="group grid grid-cols-[44px_1fr_auto] items-center gap-4 border-b border-ink/10 px-5 py-6 transition-colors last:border-b-0 hover:bg-white/45 md:grid-cols-[80px_1.1fr_0.9fr_auto] md:gap-8 md:px-8 md:py-7">
                  <span className="font-display text-[26px] font-light tabular-nums leading-none tracking-[-0.04em] text-ink/25 transition-colors group-hover:text-brick md:text-[40px]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-display text-[24px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-1.5 md:text-[30px]">{city.name} <span className="ml-2 align-middle font-sans text-sm text-ink/75">{city.hindi}</span></p>
                    <p className="stamp-sm mt-1.5 text-ink/75">{city.state} · {city.coords}</p>
                  </div>
                  <p className="hidden text-sm text-ink/75 md:block">{city.tagline}</p>
                  <div className="flex items-center gap-4">
                    <span className="stamp-sm hidden text-ink/75 sm:block">{city.localityCount} localities</span>
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 text-ink transition-all duration-300 group-hover:border-brick group-hover:bg-brick group-hover:text-cream"><ArrowUpRight size={16} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <p className="mt-7 text-sm text-ink/75">
            <Link href="/buy/" className="link-rail text-brick">See every city and locality Architech covers</Link>
          </p>
        </div>
      </section>

      {/* ================= EVIDENCE ================= */}
      <section className="pb-20 md:pb-28">
        <div className="container">
          <Reveal className="glass grid gap-10 p-7 md:grid-cols-[0.8fr_1.2fr] md:items-center md:p-10">
            <figure className="m-0">
              <div className="arch-frame-sm">
                <Pic name="stepwell" alt="Descending stone steps of the Adalaj stepwell, each level cut and recorded in sequence" className="aspect-[4/3] w-full object-cover md:aspect-[4/5]" sizes="(max-width: 768px) 100vw, 32vw" />
              </div>
              <figcaption className="stamp-sm mt-4 text-ink/75">Adalaj — evidence, level by level</figcaption>
            </figure>
            <div>
              <p className="kicker text-brick">Signal, not theatre</p>
              <h2 className="display mt-7 text-balance text-[clamp(30px,3.8vw,50px)]">Trust is measured by the <em>trail.</em></h2>
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-ink/75">We do not publish invented reviews, ratings, or partner praise. The useful signal is already on the page: source, freshness, RERA context, and a clear next action.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/guide/" className="clay-fill btn-sweep motion-press inline-flex items-center gap-2 rounded-full bg-brick px-6 py-3.5 stamp font-semibold text-cream">Read the evidence method <ArrowUpRight size={14} /></Link>
                <Link href="/review/" className="motion-press inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3.5 stamp font-semibold text-ink transition-colors hover:border-brick hover:text-brick">Give feedback <ArrowUpRight size={14} /></Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="container grid gap-12 pb-20 md:grid-cols-[0.8fr_1.2fr] md:pb-28">
        <Reveal>
          <p className="kicker text-brick">Fair questions</p>
          <h2 className="display mt-7 max-w-[380px] text-balance text-[clamp(30px,3.8vw,50px)]">Asked often, answered <em>plainly</em>.</h2>
          <p className="mt-6 flex items-center gap-2 text-sm text-ink/75"><TrendingUp size={15} className="text-trust" /> Answers reviewed with every product release.</p>
        </Reveal>
        <Reveal delay={120}>
          <div className="glass overflow-hidden px-6 md:px-8">
            {faqsFor(cityCount, localityCount).map((f, i) => (
              <details key={i} className="group border-b border-ink/10 last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-left font-display text-lg font-medium tracking-[-0.01em] transition-colors hover:text-brick md:text-xl [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/75 transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="pb-6 pr-10 text-[15px] leading-7 text-ink/75">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ================= List your property ================= */}
      <section className="pb-20 md:pb-28">
        <div className="container">
          <Reveal className="glass grid gap-10 p-7 md:grid-cols-[1.15fr_0.85fr] md:items-center md:p-10">
            <div>
              <p className="kicker text-brick">{t.list.kicker}</p>
              <h2 className="display mt-6 max-w-[640px] text-balance text-[clamp(30px,4vw,52px)]">{t.list.title} <em>{t.list.titleEm}</em>{t.list.titleSuffix}</h2>
              <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-ink/75">{t.list.copy}</p>
              <Link href="/list-property/" className="clay-fill btn-sweep motion-press mt-8 inline-flex items-center gap-2 rounded-full bg-brick px-7 py-4 stamp font-semibold text-cream">{t.list.cta} <ArrowUpRight size={16} /></Link>
            </div>
            <figure className="m-0">
              <div className="arch-frame-sm">
                <Pic name="prop-courtyard" alt="Sunlit inner courtyard of an Ahmedabad home, brick walls opening to a planted verandah" className="aspect-[4/3] w-full object-cover" sizes="(max-width: 768px) 100vw, 40vw" />
              </div>
              <figcaption className="stamp-sm mt-4 text-ink/75">Courtyard study · Ahmedabad context</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="pb-24 md:pb-32">
        <div className="container">
          <Reveal className="glass-lg glass relative overflow-hidden p-8 md:p-14">
            <div className="flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="kicker text-brick">{t.cta.kicker}</p>
                <h2 className="display mt-7 max-w-[620px] text-balance text-[clamp(38px,5.6vw,76px)] text-ink">{t.cta.title1}<em>{t.cta.title2}</em>.</h2>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href="/search" className="clay-fill btn-sweep motion-press inline-flex items-center justify-center gap-3 rounded-full bg-brick px-8 py-5 stamp font-semibold text-cream">{t.cta.start} <ArrowUpRight size={16} /></Link>
                <Link href="/buy/" className="motion-press inline-flex items-center justify-center gap-3 rounded-full border border-ink/20 px-8 py-5 stamp font-semibold text-ink transition-colors hover:border-brick hover:text-brick">{t.cta.browse}</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

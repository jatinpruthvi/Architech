"use client";
/* ARCHITECH — Home v2 "Amdavad Modern". Hero rule: preserve the centered search hierarchy,
   use locally grounded right-weighted architecture, a calm text-safe zone, responsive art direction,
   real HTML copy, and reduced-motion-safe movement. */
import { ArrowDown, ArrowUpRight, TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import PropertyCard from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import NumberTicker from "../components/magicui/NumberTicker";
import TiltCard from "../components/magicui/TiltCard";
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
    <div className="bg-paper text-ink">

      {/* ================= HERO ================= */}
      <section className="relative min-h-[540px] overflow-hidden bg-night text-cream md:min-h-[620px]">
        <div className="grain !absolute inset-0">
          <Pic name="hero-glow" alt="" className="hero-golden-hour survey-drift hero-zoom hero-art h-full w-full object-cover opacity-70" sizes="100vw" eager />
        </div>
        {/* Warm dusk scrim: deep saffron-brown reads on the text side, breaking
            into a soft ember glow on the figure side — the night sheet at golden hour. */}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(24,11,5,0.97)_0%,rgba(48,22,8,0.82)_42%,rgba(66,30,10,0.55)_78%,rgba(94,44,12,0.30)_100%)]" />
        {/* Golden-hour bloom + slow light sweep — the figure is lit, not just scrimmed. */}
        <div className="ember-bloom -right-24 top-1/4 h-[420px] w-[420px] opacity-50 md:-right-10 md:h-[520px] md:w-[520px]" aria-hidden="true" />
        <div className="glow-sweep right-0" aria-hidden="true" />
        <div className="relative z-10 container flex min-h-[540px] flex-col justify-start pb-7 pt-14 md:min-h-[620px] md:pb-9 md:pt-[clamp(4.5rem,7vh,5.5rem)]">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
            <p className="kicker fade-rise text-ember" style={{ "--d": "120ms" } as React.CSSProperties}>India · locality-first discovery</p>
            <h1 className="display mt-5 text-[clamp(38px,6.4vw,84px)] leading-[0.94] text-cream md:mt-6">
              <span className="mask-line"><span style={{ "--d": "250ms" } as React.CSSProperties}>{t.hero.h1a}<em className="font-normal not-italic text-cream/90">{t.hero.h1em}</em></span></span>
              <span className="mask-line"><span style={{ "--d": "380ms" } as React.CSSProperties}>{t.hero.h1b}</span></span>
            </h1>
            <p className="fade-rise mt-4 max-w-[520px] text-[14px] leading-6 text-cream/80 md:mt-5 md:text-[15px]" style={{ "--d": "480ms" } as React.CSSProperties}>
              {t.hero.sub}
            </p>
            <div className="search-spring-in mt-5 w-full max-w-[760px] rounded-[2rem] p-2 md:mt-6 md:p-2.5" style={{ "--d": "620ms" } as React.CSSProperties}>
              <div className="mx-auto flex justify-center">
                <HeroSearch cities={cities} popularSearches={popularSearches} heroPresets={heroPresets} example={example} />
              </div>
            </div>
          </div>
          <div className="fade-rise mt-7 flex flex-wrap items-end justify-between gap-6 border-t border-cream/20 pt-4 md:mt-9" style={{ "--d": "760ms" } as React.CSSProperties}>
            <div className="flex gap-10 md:gap-16">
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={listingCount} /></p><p className="stamp mt-1 !text-[12px] text-cream/90">{t.hero.stats[0]}</p></div>
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={localityCount} /></p><p className="stamp mt-1 !text-[12px] text-cream/90">{t.hero.stats[1]}</p></div>
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={100} suffix="%" /></p><p className="stamp mt-1 !text-[12px] text-cream/90">{t.hero.stats[2]}</p></div>
            </div>
            <p className="hidden items-center gap-2 stamp !text-[11px] text-cream/80 md:flex"><ArrowDown size={13} className="animate-bounce" /> {t.hero.scroll}</p>
          </div>
          <p className="fade-rise mt-2 stamp !text-[12px] text-cream/85" style={{ "--d": "860ms" } as React.CSSProperties}>{t.hero.demoNote}</p>
        </div>
      </section>

      {/* ================= FEATURED HOMES (tilt cards) ================= */}
      <section className="container py-24 md:py-32">
        <Reveal className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="kicker text-brick">{t.sections.curatedKicker}</p>
            <h2 className="display mt-6 max-w-[640px] text-[clamp(34px,4.4vw,60px)]">Homes worth <em className="text-brick">returning</em> to.</h2>
          </div>
          <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">{t.sections.all281Homes} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((property, i) => (
            <Reveal key={property.id} delay={i * 90}>
              <TiltCard><PropertyCard property={property} index={i} arch={i === 0} /></TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= MARKET DIRECTORY ================= */}
      <MarketDirectory projects={marketProjects} localityLinks={marketLocalityLinks} />

      {/* ================= CITY INDEX (real OSM coords) ================= */}
      <section className="contour-field border-t border-ink/12 py-24 md:py-32">
        <div className="container relative">
          <Reveal className="flex items-end justify-between gap-6">
            <div>
              <p className="kicker text-brick">{t.sections.localityKicker}</p>
              <h2 className="display mt-6 max-w-[680px] text-[clamp(34px,4.4vw,60px)]">{t.sections.localityTitle}</h2>
            </div>
            <p className="stamp hidden !text-[10px] text-ink/60 md:block">Coordinates © OpenStreetMap contributors</p>
          </Reveal>
          <div className="mt-14 border-t border-ink/15">
            {cities.map((city, i) => (
              <Reveal key={city.slug} delay={i * 40}>
                <Link href={`/buy/${city.slug}/`} className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-ink/15 py-6 transition-colors hover:bg-paper md:grid-cols-[90px_1.1fr_0.9fr_auto] md:gap-8 md:py-7">
                  <span className="index-num text-[28px] text-ink/25 transition-colors group-hover:text-brick md:text-[44px]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-display text-[26px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-2 md:text-[34px]">{city.name} <span className="ml-2 align-middle font-sans text-sm text-ink/55">{city.hindi}</span></p>
                    <p className="stamp mt-1 !text-[10px] text-ink/60">{city.state} · {city.coords}</p>
                  </div>
                  <p className="hidden text-sm text-ink/55 md:block">{city.tagline}</p>
                  <div className="flex items-center gap-4">
                    <span className="stamp !text-[11px] text-ink/60">{city.localityCount} localities</span>
                    <span className="clay-fill group-hover:border-brick group-hover:bg-brick grid h-10 w-10 place-items-center border border-ink/20 text-ink transition-all duration-300"><ArrowUpRight size={16} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-sm text-ink/60">
            <Link href="/buy/" className="link-rail text-brick">See every city and locality Architech covers</Link>
          </p>
        </div>
      </section>

      {/* ================= FEEDBACK / EVIDENCE ================= */}
      <section className="border-b border-ink/12 bg-sand/60 py-20 md:py-28">
        <div className="container grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <Reveal>
            <p className="kicker text-brick">Signal, not theatre</p>
            <h2 className="display mt-6 text-[clamp(30px,3.8vw,52px)]">Trust is measured by the <em className="text-brick">trail.</em></h2>
            <figure className="mt-8">
              <div className="arch-frame-sm img-hover grain editorial-shadow">
                <Pic name="stepwell" alt="Descending stone steps of the Adalaj stepwell, each level cut and recorded in sequence" className="aspect-[4/5] w-full object-cover" sizes="(max-width: 768px) 100vw, 32vw" />
              </div>
              <figcaption className="mt-4 flex items-center justify-between stamp !text-[10px] text-ink/60"><span>Adalaj — evidence, level by level</span><span>Study frame</span></figcaption>
            </figure>
          </Reveal>
          <Reveal delay={100} className="survey-corner border-l-2 border-brick pl-6 pt-4 md:pl-8 md:pt-6">
            <p className="max-w-2xl text-[15px] leading-7 text-ink/70">We do not publish invented reviews, ratings, or partner praise. The useful signal is already on the page: source, freshness, RERA context, and a clear next action.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/guide/" className="night-fill inline-flex items-center gap-2 bg-night px-5 py-3 stamp !text-[11px] font-semibold text-cream">Read the evidence method <ArrowUpRight size={14} /></Link><Link href="/review/" className="inline-flex items-center gap-2 border border-ink/20 px-5 py-3 stamp !text-[11px] font-semibold text-ink hover:border-brick hover:text-brick">Give feedback <ArrowUpRight size={14} /></Link></div>
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ (shadcn Accordion) ================= */}
      <section className="container grid gap-12 py-20 md:grid-cols-[0.8fr_1.2fr] md:py-28">
        <Reveal>
          <p className="kicker text-brick">Fair questions</p>
          <h2 className="display mt-6 max-w-[380px] text-[clamp(30px,3.8vw,52px)]">Asked often, answered <em className="text-brick">plainly</em>.</h2>
          <p className="mt-6 flex items-center gap-2 text-sm text-ink/60"><TrendingUp size={15} className="text-trust" /> Answers reviewed with every product release.</p>
        </Reveal>
        <Reveal delay={120}>
          <div className="border-t border-ink/15">
            {faqsFor(cityCount, localityCount).map((f, i) => (
              <details key={i} className="border-b border-ink/15">
                <summary className="cursor-pointer list-none py-6 text-left font-display text-lg font-medium tracking-[-0.01em] hover:text-brick md:text-xl [&::-webkit-details-marker]:hidden">
                  {f.q}
                </summary>
                <p className="pb-6 text-[15px] leading-7 text-ink/65">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ================= List your property ================= */}
      <section className="border-t border-ink/12 bg-sand/40 py-16 md:py-24">
        <div className="container grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <Reveal>
            <p className="kicker text-brick">{t.list.kicker}</p>
            <h2 className="display mt-5 max-w-[640px] text-[clamp(30px,4vw,54px)]">{t.list.title} <em className="text-brick">{t.list.titleEm}</em>{t.list.titleSuffix}</h2>
            <p className="mt-4 max-w-[520px] text-[15px] leading-7 text-ink/65">{t.list.copy}</p>
            <Link href="/list-property/" className="night-fill btn-sweep motion-press mt-8 inline-flex items-center gap-2 bg-night px-8 py-5 stamp !text-[12px] font-semibold text-cream">{t.list.cta} <ArrowUpRight size={16} /></Link>
          </Reveal>
          <Reveal delay={120}>
            <figure>
              <div className="arch-frame-sm img-hover grain editorial-shadow">
                <Pic name="prop-courtyard" alt="Sunlit inner courtyard of an Ahmedabad home, brick walls opening to a planted verandah" className="aspect-[4/3] w-full object-cover" sizes="(max-width: 768px) 100vw, 40vw" />
              </div>
              <figcaption className="mt-4 flex items-center justify-between stamp !text-[10px] text-ink/60"><span>Courtyard study · Ahmedabad context</span><span>Concept-preview imagery</span></figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="clay-fill grain relative overflow-hidden bg-brick py-24 text-cream md:py-32">
        <span className="ember-bloom -right-16 -top-32 h-[480px] w-[300px] opacity-40 md:-right-6" aria-hidden="true" />
        <span className="glow-sweep right-0" aria-hidden="true" />
        <div className="container relative z-10 flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <p className="kicker text-ember">{t.cta.kicker}</p>
            <h2 className="display mt-6 max-w-[620px] text-[clamp(40px,6vw,84px)] text-cream">{t.cta.title1}<em>{t.cta.title2}</em>.</h2>
          </Reveal>
          <Reveal delay={150} className="flex flex-col gap-4 sm:flex-row">
            <Link href="/search" className="paper-fill shimmer-btn motion-press inline-flex items-center gap-3 bg-paper px-8 py-5 stamp !text-[12px] font-semibold text-ink transition-transform hover:-translate-y-1">{t.cta.start} <ArrowUpRight size={16} className="text-brick" /></Link>
            <Link href="/buy/" className="motion-press inline-flex items-center gap-3 border border-cream/40 px-8 py-5 stamp !text-[12px] font-semibold text-cream transition-colors hover:border-cream hover:bg-paper/10">{t.cta.browse}</Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

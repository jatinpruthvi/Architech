"use client";
/* ARCHITECH — Home v2 "Amdavad Modern". Hero rule: preserve the centered search hierarchy,
   use locally grounded right-weighted architecture, a calm text-safe zone, responsive art direction,
   real HTML copy, and reduced-motion-safe movement. */
import { ArrowDown, ArrowUpRight, MapPin, Search, TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import PropertyCard from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import NumberTicker from "../components/magicui/NumberTicker";
import TiltCard from "../components/magicui/TiltCard";
import Pic from "../components/architech/Pic";
import MarketDirectory from "../components/architech/MarketDirectory";
import useTitle from "../hooks/useTitle";
import { getListings, getLocalities } from "@/lib/repositories";
import { applyMarket, applyQuery, type MarketCategory, type MarketIntent } from "@/lib/filters";
import { useLang } from "@/contexts/LangContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const HERO_DESKTOP = "/manus-storage/architech-ahmedabad-hero-desktop_943690a3.jpg";
const HERO_MOBILE = "/manus-storage/architech-ahmedabad-hero-mobile_7577c7e9.jpg";

const faqs = [
  { q: "How is every listing RERA-verified?", a: "Each listing is checked against the Gujarat RERA registry at publication — registration number, promoter, and completion status — and re-checked on every meaningful update. The registration number is displayed on the listing page, never behind a form." },
  { q: "What does the freshness stamp mean?", a: "It is the date a human or automated pipeline last confirmed the price, availability, and facts of the listing. Data that hasn't been re-confirmed within 14 days is flagged, and stale listings are withdrawn from search." },
  { q: "Will brokers get my phone number?", a: "No. Contact is masked by default: partners reply to your query through the platform, and your number is shared only when you explicitly choose to share it." },
  { q: "Which parts of Ahmedabad do you cover?", a: "14 localities today — including Paldi, Navrangpura, Prahlad Nagar, Thaltej, Bopal, and Satellite — with locality intelligence built from public records and OpenStreetMap data. New localities are added once we can verify them properly." },
];

const recentSearches = ["3 BHK near Law Garden", "Courtyard homes in Paldi"];
const popularSearches = [["Prahlad Nagar", 68], ["Thaltej", 54], ["Bopal", 47], ["Under ₹1.5 Cr", 117]] as const;

type HeroIntent = MarketIntent;
type HeroCategory = Exclude<MarketCategory, "all">;

function HeroSearch() {
  const router = useRouter();
  const navigate = (url: string) => router.push(url);
  const { t } = useLang();
  const reducedMotion = useReducedMotion();
  const [intent, setIntent] = useState<HeroIntent>("buy");
  const [category, setCategory] = useState<HeroCategory>("residential");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const queryLen = query.trim().length;

  // Build the search URL, ALWAYS carrying intent + category so the toggle works.
  const buildParams = useMemo(() => {
    const p = new URLSearchParams();
    if (intent !== "buy") p.set("intent", intent);
    if (category !== "residential") p.set("category", category);
    return p;
  }, [intent, category]);

  const go = (q: string) => {
    const p = new URLSearchParams(buildParams);
    if (q.trim()) p.set("q", q.trim());
    navigate(`/search?${p.toString()}`);
  };

  // Server-backed, debounced suggestion ranking from the canonical alias module.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setSuggestions([...recentSearches, ...popularSearches.map(([l]) => l as string)]);
      setLoadingSug(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingSug(true);
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
        const data = await r.json();
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions.map((s: { query: string }) => s.query));
      } catch {
        /* ignore aborted */
      } finally {
        if (!ctrl.signal.aborted) setLoadingSug(false);
      }
    }, 160);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  // Reset keyboard/visual selection when the input list changes.
  useEffect(() => { setHighlight(-1); }, [suggestions]);

  // Keep selection within bounds.
  const options = suggestions;
  const optionCount = options.length;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!focused) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((i) => (i + 1) % Math.max(1, optionCount)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((i) => (i <= 0 ? Math.max(0, optionCount - 1) : i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && options[highlight]) go(options[highlight]);
      else go(query);
      setFocused(false);
    } else if (e.key === "Escape") { setFocused(false); setHighlight(-1); }
  };

  // Close on outside click but keep selection when interacting with the panel.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const setIntentAndFocus = (v: HeroIntent) => { setIntent(v); setHighlight(-1); inputRef.current?.focus(); };

  const intentLabel = intent === "rent" ? t.hero.rent : t.hero.buy;
  const categoryLabel = category === "residential" ? "homes" : category === "pg" ? "PG / co-living" : category;
  const searchContext = `${intentLabel} ${categoryLabel} in`;
  const resultCount = useMemo(() => {
    const listings = getListings();
    const cat: MarketCategory = category;
    return applyQuery(applyMarket(listings, cat, intent), query.trim()).length;
  }, [intent, category, query]);

  return (
    <div ref={wrapRef} className="fade-rise relative w-full max-w-[700px]" style={{ "--d": "560ms" } as React.CSSProperties}>
      {/* Intent + category controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-2xl border border-cream/25 bg-paper/10 p-1 backdrop-blur-md" role="tablist" aria-label="Buy or rent">
          {(["buy", "rent"] as HeroIntent[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setIntentAndFocus(v)}
              role="tab"
              aria-selected={intent === v}
              className={`relative rounded-xl px-6 py-2.5 stamp !text-[11px] font-semibold transition-all duration-300 ${intent === v ? "text-cream" : "text-cream/60 hover:text-cream"}`}
            >
              {intent === v && <motion.span layoutId="hero-intent-highlight" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 34 }} className="absolute inset-0 rounded-xl bg-brick motion-spring-in" aria-hidden="true" />}
              <span className="relative z-10">{v === "buy" ? t.hero.buy : t.hero.rent}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["residential", "commercial", "pg", "plot", "land", "auction"] as HeroCategory[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setCategory(c); setHighlight(-1); }}
              aria-pressed={category === c}
              className={`rounded-full px-3 py-1.5 stamp !text-[10px] font-semibold transition-colors duration-200 ${category === c ? "bg-cream/20 text-cream ring-1 ring-cream/30" : "text-cream/55 hover:bg-cream/10 hover:text-cream"}`}
            >
              {c === "residential" ? t.hero.buy : c}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); go(query); }}
        className="search-composer mt-3 flex items-stretch rounded-2xl border border-cream/25 bg-paper/10 backdrop-blur-md transition-all duration-300 focus-within:border-ember focus-within:bg-paper/20 focus-within:shadow-[0_14px_40px_rgba(0,0,0,0.32)] focus-within:ring-1 focus-within:ring-ember/60"
        role="search" aria-label={`Search ${intentLabel} in Ahmedabad`}>
        <span className="grid w-14 shrink-0 place-items-center border-r border-cream/15 text-cream/60 sm:w-[150px] sm:place-items-start sm:px-4"><span className="hidden sm:block"><span className="block stamp !text-[9px] text-cream/45">{searchContext}</span><span className="mt-1 block font-display text-sm text-cream/90">Ahmedabad</span></span><Search size={19} className="sm:hidden" /></span>
        <input
          ref={inputRef}
          value={query} onChange={(e) => { setQuery(e.target.value); }}
          onFocus={() => setFocused(true)} onBlur={() => { /* keep open until outside click */ }}
          onKeyDown={onKeyDown}
          placeholder={intent === "buy" ? t.hero.placeholderBuy : t.hero.placeholderRent}
          className="w-full bg-transparent py-4 pr-2 text-[15px] text-cream placeholder:text-cream/60 focus:outline-none focus-visible:bg-transparent focus-visible:ring-0"
          aria-label={`Search ${intentLabel} by locality, project, or BHK`} role="combobox" aria-expanded={focused && (queryLen > 0 || true)} aria-controls={focused ? "search-suggestions" : undefined}
          aria-activedescendant={focused && highlight >= 0 ? `sug-${highlight}` : undefined} aria-autocomplete="list" autoComplete="off"
        />
        <button type="submit" className="shimmer-btn motion-press my-1.5 mr-1.5 ml-1 rounded-xl bg-brick px-6 stamp !text-[12px] font-semibold text-cream transition-colors hover:bg-brick-deep">{t.hero.search}</button>
      </form>

      {/* Animated suggestions */}
      {focused && <div className="overflow-hidden transition-[opacity,transform,max-height] duration-300 ease-out max-h-[420px] translate-y-0 opacity-100">
        <div id="search-suggestions" className="mt-2 rounded-2xl border border-ink/15 bg-paper text-ink shadow-lg" role="listbox" aria-label="Search suggestions">
          {options.length ? (
            <div className="max-h-[360px] overflow-y-auto p-3" role="group" aria-label="Search suggestion choices">
              <p className="stamp px-1 !text-[9px] text-ink/50">{queryLen ? `Suggestions for “${query.trim()}”` : `${intentLabel} — start here`}{loadingSug ? " · loading…" : ""}</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {options.slice(0, 12).map((label, i) => (
                  <button
                    key={`${label}-${i}`}
                    id={`sug-${i}`}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); go(label); }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`group flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm transition-colors duration-150 ${highlight === i ? "border-brick/25 bg-sand/70 text-brick" : "text-ink/80 hover:border-brick/20 hover:bg-sand/50 hover:text-brick"}`}
                    role="option" aria-selected={highlight === i}
                  >
                    <MapPin size={14} className={`shrink-0 transition-colors ${highlight === i ? "text-brick" : "text-ink/40 group-hover:text-brick"}`} />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div role="group" aria-label="No search matches" className="p-4 text-center text-sm text-ink/55">No matches — try a locality or BHK.</div>
          )}
          <p role="group" aria-label="Search keyboard help" className="stamp border-t border-ink/10 px-4 py-2.5 !text-[9px] text-ink/50">↑↓ to move · Enter to search · Esc to close · {resultCount} {intentLabel} match{resultCount === 1 ? "" : "es"} for this scope</p>
        </div>
      </div>}

      {/* Quick chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="stamp !text-[10px] text-cream/60">{t.hero.beginWith}</span>
        {["Paldi", "Thaltej", "Navrangpura", "Bopal"].map((l) => (
          <Link
            key={l}
            href={`/search?q=${encodeURIComponent(l)}&${buildParams.toString()}`}
            className="rounded-full border border-cream/25 px-3 py-1.5 stamp !text-[11px] text-cream/85 transition-all duration-200 hover:-translate-y-0.5 hover:border-ember hover:bg-cream/10 hover:text-ember"
          >{l}</Link>
        ))}
        <span className="mx-1 h-4 w-px bg-cream/20" aria-hidden="true" />
        {["under 1 cr", "under 1.5 cr", "ready to move"].map((preset) => (
          <button key={preset} type="button" onClick={() => { setQuery(preset); go(preset); }} className="rounded-full border border-cream/15 px-3 py-1.5 stamp !text-[10px] text-cream/65 transition-all duration-200 hover:-translate-y-0.5 hover:border-ember hover:text-ember">{preset === "under 1 cr" ? "Under ₹1 Cr" : preset === "under 1.5 cr" ? "Under ₹1.5 Cr" : "Ready to move"}</button>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  useTitle("");
  const { t } = useLang();
  return (
    <div className="bg-paper text-ink">

      {/* ================= HERO ================= */}
      <section className="relative min-h-[540px] overflow-hidden bg-night text-cream md:min-h-[620px]">
        <div className="grain !absolute inset-0">
          <Pic name="hero-ahmedabad" alt="" src={HERO_DESKTOP} mobileSrc={HERO_MOBILE} className="hero-zoom hero-art h-full w-full object-cover opacity-75" sizes="100vw" eager />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(34,24,21,0.94)_0%,rgba(34,24,21,0.66)_42%,rgba(34,24,21,0.18)_100%)]" />
        <div className="relative z-10 container flex min-h-[540px] flex-col justify-start pb-7 pt-14 md:min-h-[620px] md:pb-9 md:pt-[clamp(4.5rem,7vh,5.5rem)]">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
            <p className="kicker fade-rise text-ember" style={{ "--d": "120ms" } as React.CSSProperties}>Ahmedabad · Amdavad</p>
            <h1 className="display mt-5 text-[clamp(38px,6.4vw,84px)] leading-[0.94] text-cream md:mt-6">
              <span className="mask-line"><span style={{ "--d": "250ms" } as React.CSSProperties}>{t.hero.h1a}<em className="font-normal not-italic text-cream/90">{t.hero.h1em}</em></span></span>
              <span className="mask-line"><span style={{ "--d": "380ms" } as React.CSSProperties}>{t.hero.h1b}</span></span>
            </h1>
            <p className="fade-rise mt-4 max-w-[520px] text-[14px] leading-6 text-cream/70 md:mt-5 md:text-[15px]" style={{ "--d": "480ms" } as React.CSSProperties}>
              {t.hero.sub}
            </p>
            <div className="field-rule fade-rise mt-5 w-full max-w-[760px] border border-cream/25 bg-night/45 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm md:mt-6 md:p-2.5" style={{ "--d": "620ms" } as React.CSSProperties}>
              <div className="mx-auto flex justify-center">
                <HeroSearch />
              </div>
            </div>
          </div>
          <div className="fade-rise mt-7 flex flex-wrap items-end justify-between gap-6 border-t border-cream/20 pt-4 md:mt-9" style={{ "--d": "760ms" } as React.CSSProperties}>
            <div className="flex gap-10 md:gap-16">
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={281} /></p><p className="stamp mt-1 !text-[10px] text-cream/65">{t.hero.stats[0]}</p></div>
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={14} /></p><p className="stamp mt-1 !text-[10px] text-cream/65">{t.hero.stats[1]}</p></div>
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={100} suffix="%" /></p><p className="stamp mt-1 !text-[10px] text-cream/65">{t.hero.stats[2]}</p></div>
            </div>
            <p className="hidden items-center gap-2 stamp !text-[10px] text-cream/60 md:flex"><ArrowDown size={13} className="animate-bounce" /> {t.hero.scroll}</p>
          </div>
          <p className="fade-rise mt-2 stamp !text-[9px] text-cream/60" style={{ "--d": "860ms" } as React.CSSProperties}>{t.hero.demoNote}</p>
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
          {getListings().map((property, i) => (
            <Reveal key={property.id} delay={i * 90}>
              <TiltCard><PropertyCard property={property} index={i} arch={i === 0} /></TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= MARKET DIRECTORY ================= */}
      <MarketDirectory />

      {/* ================= LOCALITY INDEX (real OSM coords) ================= */}
      <section className="border-t border-ink/12 bg-sand/40 py-24 md:py-32">
        <div className="container">
          <Reveal className="flex items-end justify-between gap-6">
            <div>
              <p className="kicker text-brick">{t.sections.localityKicker}</p>
              <h2 className="display mt-6 max-w-[680px] text-[clamp(34px,4.4vw,60px)]">{t.sections.localityTitle}</h2>
            </div>
            <p className="stamp hidden !text-[10px] text-ink/60 md:block">Coordinates © OpenStreetMap contributors</p>
          </Reveal>
          <div className="mt-14 border-t border-ink/15">
            {getLocalities().map((place, i) => (
              <Reveal key={place.slug} delay={i * 50}>
                <Link href={`/buy/ahmedabad/${place.slug}/`} className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-ink/15 py-6 transition-colors hover:bg-paper md:grid-cols-[90px_1.1fr_0.9fr_auto] md:gap-8 md:py-7">
                  <span className="index-num text-[28px] text-ink/25 transition-colors group-hover:text-brick md:text-[44px]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-display text-[26px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-2 md:text-[34px]">{place.name} <span className="ml-2 align-middle font-sans text-sm text-ink/55">{place.hindi}</span></p>
                    <p className="stamp mt-1 !text-[10px] text-ink/60">{place.coords}</p>
                  </div>
                  <p className="hidden text-sm text-ink/55 md:block">{place.note}</p>
                  <div className="flex items-center gap-4">
                    <span className="stamp !text-[11px] text-ink/60">{place.homes} {t.sections.homesCount}</span>
                    <span className="grid h-10 w-10 place-items-center border border-ink/20 text-ink transition-all duration-300 group-hover:border-brick group-hover:bg-brick group-hover:text-cream"><ArrowUpRight size={16} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEEDBACK / EVIDENCE ================= */}
      <section className="border-b border-ink/12 bg-sand/60 py-20 md:py-28">
        <div className="container grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <Reveal>
            <p className="kicker text-brick">Signal, not theatre</p>
            <h2 className="display mt-6 text-[clamp(30px,3.8vw,52px)]">Trust is measured by the <em className="text-brick">trail.</em></h2>
          </Reveal>
          <Reveal delay={100} className="border-l-2 border-brick pl-6 md:pl-8">
            <p className="max-w-2xl text-[15px] leading-7 text-ink/70">We do not publish invented reviews, ratings, or partner praise. The useful signal is already on the page: source, freshness, RERA context, and a clear next action.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/guide/" className="inline-flex items-center gap-2 bg-night px-5 py-3 stamp !text-[11px] font-semibold text-cream">Read the evidence method <ArrowUpRight size={14} /></Link><Link href="/review/" className="inline-flex items-center gap-2 border border-ink/20 px-5 py-3 stamp !text-[11px] font-semibold text-ink hover:border-brick hover:text-brick">Give feedback <ArrowUpRight size={14} /></Link></div>
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
          <Accordion type="single" collapsible className="border-t border-ink/15">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b border-ink/15">
                <AccordionTrigger className="py-6 text-left font-display text-lg font-medium tracking-[-0.01em] hover:text-brick hover:no-underline md:text-xl">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-6 text-[15px] leading-7 text-ink/65">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </section>

      {/* ================= List your property ================= */}
      <section className="border-t border-ink/12 bg-sand/40 py-16 md:py-24">
        <div className="container grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <Reveal>
            <p className="kicker text-brick">{t.list.kicker}</p>
            <h2 className="display mt-5 max-w-[640px] text-[clamp(30px,4vw,54px)]">{t.list.title} <em className="text-brick">{t.list.titleEm}</em>{t.list.titleSuffix}</h2>
            <p className="mt-4 max-w-[520px] text-[15px] leading-7 text-ink/65">{t.list.copy}</p>
          </Reveal>
          <Reveal delay={120}>
            <Link href="/list-property/" className="btn-sweep motion-press inline-flex items-center gap-2 bg-night px-8 py-5 stamp !text-[12px] font-semibold text-cream">{t.list.cta} <ArrowUpRight size={16} /></Link>
          </Reveal>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="grain relative overflow-hidden bg-brick py-24 text-cream md:py-32">
        <span className="pointer-events-none absolute -right-24 -top-40 h-[480px] w-[300px] rounded-t-full bg-ember/20 md:-right-10" aria-hidden="true" />
        <div className="container relative z-10 flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <p className="kicker text-ember">{t.cta.kicker}</p>
            <h2 className="display mt-6 max-w-[620px] text-[clamp(40px,6vw,84px)] text-cream">{t.cta.title1}<em>{t.cta.title2}</em>.</h2>
          </Reveal>
          <Reveal delay={150} className="flex flex-col gap-4 sm:flex-row">
            <Link href="/search" className="shimmer-btn motion-press inline-flex items-center gap-3 bg-paper px-8 py-5 stamp !text-[12px] font-semibold text-ink transition-transform hover:-translate-y-1">{t.cta.start} <ArrowUpRight size={16} className="text-brick" /></Link>
            <Link href="/buy/ahmedabad/" className="motion-press inline-flex items-center gap-3 border border-cream/40 px-8 py-5 stamp !text-[12px] font-semibold text-cream transition-colors hover:border-cream hover:bg-paper/10">{t.cta.browse}</Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

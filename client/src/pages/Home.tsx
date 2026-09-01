"use client";
/* ARCHITECH — Home v2 "Amdavad Modern". Hero rule: preserve the centered search hierarchy,
   use locally grounded right-weighted architecture, a calm text-safe zone, responsive art direction,
   real HTML copy, and reduced-motion-safe movement. */
import { ArrowDown, ArrowUpRight, Search, TrendingUp } from "lucide-react";
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
import { getCities, getFeaturedListings, getListings, getLocalities } from "@/lib/repositories";
import { applyMarket, applyQuery, type MarketIntent } from "@/lib/filters";
import { parseSearchQuery, parsedQueryToSearchUrl, describeParsedQuery, formatBudget } from "@/lib/search/parse-query";
import SuggestRow from "@/components/architech/SuggestRow";
import { useSuggestCombobox } from "@/components/architech/useSuggestCombobox";
import { exampleQuery, popularQueries, type SearchSuggestion } from "@/lib/search/suggest";
import { readRecentSearches, rememberRecentSearch } from "@/lib/search/recent";
import { useLang } from "@/contexts/LangContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "How does RERA verification work across India?", a: "The listing’s reviewed state or union territory selects the applicable authority. A badge requires an approved adapter and a matching registration, promoter, project, and status record; unsupported authorities remain visibly unverified and are never checked against Gujarat as a fallback." },
  { q: "What does the freshness stamp mean?", a: "In production it records when price, availability, and listing facts were last confirmed. Current concept-preview dates are deterministic demo data, not evidence that a live listing was re-checked." },
  { q: "Will brokers get my phone number?", a: "Requirement capture stores contact digits encrypted and displays only a masked number. Production partner access and explicit sharing remain gated until the consent and access-control workflow is approved." },
  { q: "Which cities do you cover?", a: `The concept registry currently demonstrates ${getCities().length} Indian city markets — Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad, Gurugram, Noida, Surat and Jaipur — across ${getLocalities().length} locality fixtures. Production coverage goes live city by city only after source and locality review.` },
];

/* Popular searches are derived from live inventory, so the labels and the
   counts beside them are the same numbers the results page will show. */
const popularSearches = popularQueries({}, 4);

type HeroIntent = MarketIntent;

function HeroSearch() {
  const router = useRouter();
  const navigate = (url: string) => router.push(url);
  const { t } = useLang();
  const [intent, setIntent] = useState<HeroIntent>("buy");
  // "New projects" is not a transaction intent (buy/rent) but an availability
  // scope, so it stays a separate hero state that maps to the `availability-new`
  // filter token — the market model is unchanged.
  const [newProjects, setNewProjects] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const queryLen = query.trim().length;

  // Build the search URL, always carrying the intent toggle.
  // "New projects" carries the availability-new filter instead of a fake intent.
  const buildParams = useMemo(() => {
    const p = new URLSearchParams();
    if (intent !== "buy") p.set("intent", intent);
    if (newProjects) p.set("filters", "availability-new");
    return p;
  }, [intent, newProjects]);

  /**
   * Navigate for a typed query. The query is parsed first, so "3 bhk in
   * koramangala under 2 cr" arrives as real city/filter parameters instead of
   * an opaque `q=` string the results page has to re-guess.
   */
  const go = (q: string, href?: string) => {
    const trimmed = q.trim();
    if (trimmed) rememberRecentSearch(trimmed);
    if (href) { navigate(href); return; }

    const parsed = parseSearchQuery(trimmed);
    if (parsed.understood) {
      const url = new URL(parsedQueryToSearchUrl(parsed), "https://architech.local");
      // The hero's own intent toggle is an explicit user choice and outranks
      // anything inferred from the words.
      if (intent !== "buy") url.searchParams.set("intent", intent);
      if (newProjects) url.searchParams.set("filters", "availability-new");
      navigate(`${url.pathname}${url.search}`);
      return;
    }

    const p = new URLSearchParams(buildParams);
    if (trimmed) p.set("q", trimmed);
    navigate(`/search?${p.toString()}`);
  };

  // Server-backed, debounced suggestion ranking from the canonical suggest
  // module. Suggestions are objects, not bare strings, so the panel can show
  // what each one means (how many homes, which city) before it is chosen.
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recents, setRecents] = useState<SearchSuggestion[]>([]);

  // Real recent searches, read once on mount — never a hardcoded sample.
  useEffect(() => { setRecents(readRecentSearches()); }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setSuggestions([...recents, ...popularSearches]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest/?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
        const data = await r.json();
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions as SearchSuggestion[]);
      } catch {
        /* aborted, or the endpoint is down: the panel simply shows nothing extra */
      }
    }, 160);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query, recents]);

  /* One option list for the panel: recents + curated populars while the box is
     empty, fetched suggestions once there is a query. */
  const options = query.trim().length === 0 ? [...recents, ...popularSearches] : suggestions;

  /* Focus, highlight and the ↑↓/Enter/Escape contract come from the shared
     combobox module — the results page uses the same one, so the two search
     boxes cannot drift into two different controls again. */
  const sug = useSuggestCombobox({
    query,
    suggestions: options,
    openWhenEmpty: true,
    commit: (q, href) => go(q, href),
  });
  const inputRef = sug.inputRef;

  const setIntentAndFocus = (v: HeroIntent) => { setIntent(v); inputRef.current?.focus(); };

  const intentLabel = intent === "rent" ? t.hero.rent : t.hero.buy;
  // The placeholder names a locality that genuinely has inventory, so the
  // example in the box is never a query that returns nothing.
  const heroExample = useMemo(() => exampleQuery(), []);
  const parsedPreview = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return "";
    const parsed = parseSearchQuery(trimmed);
    return parsed.understood ? describeParsedQuery(parsed) : "";
  }, [query]);
  const searchContext = `${intentLabel} homes in`;
  /* Budget chips derived from the real price distribution rather than two
     round numbers that may not split the inventory at all. */
  const heroPresets = useMemo(() => {
    const buyPrices = getListings().filter((l) => (l.transaction ?? "buy") === "buy").map((l) => l.priceNum).sort((a, b) => a - b);
    const at = (fraction: number) => buyPrices[Math.floor(buyPrices.length * fraction)] ?? 0;
    const round = (value: number) => Math.max(5_000_000, Math.round(value / 2_500_000) * 2_500_000);
    const cheap = round(at(0.25));
    const mid = round(at(0.6));
    const presets = [{ query: `under ${cheap / 10_000_000} cr`, label: `Under ${formatBudget(cheap)}` }];
    if (mid > cheap) presets.push({ query: `under ${mid / 10_000_000} cr`, label: `Under ${formatBudget(mid)}` });
    presets.push({ query: "ready to move", label: "Ready to move" });
    return presets;
  }, []);

  const resultCount = useMemo(() => {
    const listings = getListings();
    const scoped = newProjects
      ? listings.filter((l) => (l as { availability?: string }).availability === "NEW_LAUNCH")
      : applyMarket(listings, "residential", intent);
    return applyQuery(scoped, query.trim()).length;
  }, [intent, query, newProjects]);

  return (
    <div ref={wrapRef} className="fade-rise relative w-full max-w-[700px]" style={{ "--d": "560ms" } as React.CSSProperties}>
      {/* Primary intent segmented control — Buy / Rent / New projects */}
      <div className="flex justify-center">
        <div className="glass-tabs inline-flex rounded-full p-1" role="tablist" aria-label="Buy, rent or new projects">
          {([
            { id: "buy", label: t.hero.buy, on: () => { setNewProjects(false); setIntentAndFocus("buy"); }, active: intent === "buy" && !newProjects },
            { id: "rent", label: t.hero.rent, on: () => { setNewProjects(false); setIntentAndFocus("rent"); }, active: intent === "rent" },
            { id: "new", label: t.hero.newProjects, on: () => { setNewProjects(true); setIntent("buy"); inputRef.current?.focus(); }, active: newProjects },
          ] as const).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={v.on}
              role="tab"
              aria-selected={v.active}
              className={`relative rounded-full px-4 py-2.5 stamp !text-[13px] font-semibold transition-all duration-300 sm:px-5 ${v.active ? "seg-active text-cream dark:text-[#2a1305]" : "text-cream/70 hover:text-cream"}`}
            >
              <span className="relative z-10">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); go(query); }}
        className="search-composer field-shell [--field-focus:var(--ember)] search-glass mt-4 flex items-stretch rounded-2xl transition-all duration-300"
        role="search" aria-label={`Search ${intentLabel} across India`}>
        <span className="grid w-14 shrink-0 place-items-center border-r border-cream/20 text-cream/80 sm:w-[150px] sm:justify-items-start sm:px-4"><span className="hidden sm:block"><span className="hero-read block stamp !text-[12px] text-cream/95">{searchContext}</span><span className="hero-read mt-1 block font-display text-sm text-cream/95">All India</span></span><Search size={19} className="sm:hidden" /></span>
        <input
          value={query} onChange={(e) => { setQuery(e.target.value); }}
          placeholder={`Try “${heroExample}”, a PIN code, or any city…`}
          className="hero-read w-full bg-transparent py-4 pl-4 pr-2 text-[15px] text-cream placeholder:text-cream/80 focus:outline-none focus-visible:bg-transparent focus-visible:ring-0"
          aria-label={`Search ${intentLabel} by locality, project, or BHK`}
          {...sug.inputProps}
        />
        <button type="submit" className="clay-fill shimmer-btn motion-press btn-primary mx-1.5 my-1.5 inline-flex items-center justify-center border border-white/15 bg-brick px-6 text-center stamp !text-[12px] font-semibold text-cream transition-colors hover:bg-brick-deep">{t.hero.search}</button>
      </form>

      {/* Animated suggestions */}
      {sug.open && (
      <div className="overflow-hidden transition-[opacity,transform,max-height] duration-300 ease-out max-h-[420px] translate-y-0 opacity-100">
        <div
          ref={sug.listRef}
          id={sug.listId}
          className="mt-2 rounded-2xl border border-ink/15 bg-paper text-ink shadow-lg"
          role="listbox"
          aria-label="Search suggestions"
        >
          {sug.visible.length ? (
            <div className="max-h-[360px] overflow-y-auto p-3">
              <p className="stamp px-1 ink-3">{queryLen ? `Suggestions for “${query.trim()}”` : recents.length ? "Recent and popular" : `${intentLabel} starts here`}</p>
              {/* Say out loud how the typed words were understood, before the
                  search runs, so a misread is visible rather than mysterious. */}
              {parsedPreview && <p className="mt-1 px-1 stamp text-brick">Reads as: {parsedPreview}</p>}
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {sug.visible.map((option, i) => (
                  <SuggestRow
                    key={`${option.kind}-${option.query}-${i}`}
                    option={option}
                    index={i}
                    id={`${sug.listId}-opt-${i}`}
                    highlighted={sug.highlight === i}
                    onHover={sug.optionHandlers.onHover}
                    onSelect={sug.optionHandlers.onSelect}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div role="group" aria-label="No search matches" className="p-4 text-center text-sm text-ink/55">No matches — try a locality, a city, a PIN, or “2 bhk under 1.5 cr”.</div>
          )}
          <p role="group" aria-label="Search keyboard help" className="stamp border-t border-ink/10 px-4 py-2.5 !text-[11px] text-ink/50">↑↓ to move · Enter to search · Esc to close · {resultCount} {intentLabel} match{resultCount === 1 ? "" : "es"} for this scope</p>
        </div>
      </div>
      )}

      {/* Quick chips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="glass-chip rounded-full px-3 py-1.5 stamp !text-[12px]">{t.hero.beginWith}</span>
        {getCities().slice(0, 4).map((city) => city.name).map((l) => (
          <Link
            key={l}
            href={`/search?q=${encodeURIComponent(l)}&${buildParams.toString()}`}
            className="glass-chip rounded-full px-3 py-1.5 stamp !text-[12px] hover:-translate-y-0.5"
          >{l}</Link>
        ))}
        <span className="mx-1 h-4 w-px bg-cream/30" aria-hidden="true" />
        {heroPresets.map((preset) => (
          <button key={preset.query} type="button" onClick={() => { setQuery(preset.query); go(preset.query); }} className="glass-chip rounded-full px-3 py-1.5 stamp !text-[12px] hover:-translate-y-0.5">{preset.label}</button>
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
                <HeroSearch />
              </div>
            </div>
          </div>
          <div className="fade-rise mt-7 flex flex-wrap items-end justify-between gap-6 border-t border-cream/20 pt-4 md:mt-9" style={{ "--d": "760ms" } as React.CSSProperties}>
            <div className="flex gap-10 md:gap-16">
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={getListings().length} /></p><p className="stamp mt-1 !text-[12px] text-cream/90">{t.hero.stats[0]}</p></div>
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={getLocalities().length} /></p><p className="stamp mt-1 !text-[12px] text-cream/90">{t.hero.stats[1]}</p></div>
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
          {getFeaturedListings(6).map((property, i) => (
            <Reveal key={property.id} delay={i * 90}>
              <TiltCard><PropertyCard property={property} index={i} arch={i === 0} /></TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= MARKET DIRECTORY ================= */}
      <MarketDirectory />

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
            {getCities().map((city, i) => (
              <Reveal key={city.slug} delay={i * 40}>
                <Link href={`/buy/${city.slug}/`} className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-ink/15 py-6 transition-colors hover:bg-paper md:grid-cols-[90px_1.1fr_0.9fr_auto] md:gap-8 md:py-7">
                  <span className="index-num text-[28px] text-ink/25 transition-colors group-hover:text-brick md:text-[44px]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-display text-[26px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-2 md:text-[34px]">{city.name} <span className="ml-2 align-middle font-sans text-sm text-ink/55">{city.hindi}</span></p>
                    <p className="stamp mt-1 !text-[10px] text-ink/60">{city.state} · {city.coords}</p>
                  </div>
                  <p className="hidden text-sm text-ink/55 md:block">{city.tagline}</p>
                  <div className="flex items-center gap-4">
                    <span className="stamp !text-[11px] text-ink/60">{getLocalities(city.slug).length} localities</span>
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

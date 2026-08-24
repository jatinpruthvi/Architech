"use client";
/* ARCHITECH — Home v2 "Amdavad Modern", upgraded with the MCP toolkit:
   Magic-UI-style (NumberTicker, BorderBeam, Shimmer, TiltCard, WordReveal, Marquee),
   shadcn/ui (Tabs, Accordion), 21st.dev patterns (bento, testimonial rails),
   OpenStreetMap-sourced coordinates for every locality. */
import { ArrowDown, ArrowUpRight, Compass, Quote, Search, ShieldCheck, Timer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PropertyCard, { properties } from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import NumberTicker from "../components/magicui/NumberTicker";
import TiltCard from "../components/magicui/TiltCard";
import WordReveal from "../components/magicui/WordReveal";
import Marquee from "../components/magicui/Marquee";
import Pic from "../components/architech/Pic";
import useTitle from "../hooks/useTitle";
import { localities } from "@/lib/localities";
import { useLang } from "@/contexts/LangContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const tickerItems = ["Paldi", "Navrangpura", "Thaltej", "Bopal", "Satellite", "Ambawadi", "Vastrapur", "Maninagar", "Gulbai Tekra", "Sindhu Bhavan"];

const testimonials = [
  { quote: "The freshness stamps changed how I shortlisted. I stopped calling about homes that were already gone.", name: "Kinjal S.", role: "Bought in Paldi" },
  { quote: "First portal where the RERA number was on the page, not behind a form.", name: "Rohan M.", role: "Bought in Thaltej" },
  { quote: "Masked contact actually works. Zero spam calls in three months of searching.", name: "Devanshi P.", role: "Renting in Navrangpura" },
  { quote: "As a broker, the verification badge earns me trust I used to spend weeks building.", name: "Nivasa Partners", role: "Verified partner" },
  { quote: "The locality notes read like a friend who lives there wrote them.", name: "Arjun K.", role: "Exploring Bopal" },
  { quote: "I chose the neighbourhood first, exactly like the site told me to. No regrets.", name: "Sana V.", role: "Bought in Satellite" },
];

const faqs = [
  { q: "How is every listing RERA-verified?", a: "Each listing is checked against the Gujarat RERA registry at publication — registration number, promoter, and completion status — and re-checked on every meaningful update. The registration number is displayed on the listing page, never behind a form." },
  { q: "What does the freshness stamp mean?", a: "It is the date a human or automated pipeline last confirmed the price, availability, and facts of the listing. Data that hasn't been re-confirmed within 14 days is flagged, and stale listings are withdrawn from search." },
  { q: "Will brokers get my phone number?", a: "No. Contact is masked by default: partners reply to your query through the platform, and your number is shared only when you explicitly choose to share it." },
  { q: "Which parts of Ahmedabad do you cover?", a: "14 localities today — including Paldi, Navrangpura, Prahlad Nagar, Thaltej, Bopal, and Satellite — with locality intelligence built from public records and OpenStreetMap data. New localities are added once we can verify them properly." },
];

const recentSearches = ["3 BHK near Law Garden", "Courtyard homes in Paldi"];
const popularSearches = [["Prahlad Nagar", 68], ["Thaltej", 54], ["Bopal", 47], ["Under ₹1.5 Cr", 117]] as const;

function HeroSearch() {
  const router = useRouter();
  const navigate = (url: string) => router.push(url);
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("buy");
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const options = [...recentSearches, ...popularSearches.map(([l]) => l)];

  const go = (q: string) => navigate(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!focused) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((i) => (i + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((i) => (i <= 0 ? options.length - 1 : i - 1)); }
    else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); go(options[highlight]); }
    else if (e.key === "Escape") { setFocused(false); setHighlight(-1); }
  };

  return (
    <div className="fade-rise relative w-full max-w-[640px]" style={{ "--d": "700ms" } as React.CSSProperties}>
      <Tabs value={intent} onValueChange={setIntent}>
        <TabsList className="h-auto rounded-none border border-b-0 border-cream/25 bg-paper/10 p-0 backdrop-blur-md">
          {[["buy", t.hero.buy], ["rent", t.hero.rent]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="rounded-none border-0 px-7 py-3 stamp !text-[11px] font-semibold text-cream/60 data-[state=active]:bg-brick data-[state=active]:text-cream data-[state=active]:shadow-none">{l}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <form
        onSubmit={(e) => { e.preventDefault(); go(query); }}
        className="flex items-stretch border border-cream/25 bg-paper/10 backdrop-blur-md transition-colors focus-within:border-cream/60"
        role="search" aria-label="Search homes in Ahmedabad">
        <span className="grid w-14 place-items-center text-cream/60"><Search size={19} /></span>
        <input
          value={query} onChange={(e) => { setQuery(e.target.value); setHighlight(-1); }}
          onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setHighlight(-1); }}
          onKeyDown={onKeyDown}
          placeholder={intent === "buy" ? t.hero.placeholderBuy : t.hero.placeholderRent}
          className="w-full bg-transparent py-5 pr-2 text-[15px] text-cream placeholder:text-cream/60 focus:outline-none"
          aria-label="Search query" role="combobox" aria-expanded={focused} aria-controls="search-suggestions"
          aria-activedescendant={highlight >= 0 ? `sug-${highlight}` : undefined} aria-autocomplete="list"
        />
        <button type="submit" className="shimmer-btn motion-press m-2 bg-brick px-6 stamp !text-[12px] font-semibold text-cream">{t.hero.search}</button>
      </form>
      {focused && (
        <div id="search-suggestions" className="absolute inset-x-0 top-full z-30 mt-2 border border-ink/15 bg-paper text-ink editorial-shadow" role="listbox" aria-label="Search suggestions">
          <div className="p-4">
            <p className="stamp !text-[10px] text-ink/60">Recent searches</p>
            {recentSearches.map((s, i) => (
              <button key={s} id={`sug-${i}`} onMouseDown={(e) => { e.preventDefault(); go(s); }}
                className={`mt-1.5 flex w-full items-center gap-2.5 px-2 py-2.5 text-left text-sm transition-colors ${highlight === i ? "bg-sand text-brick" : "text-ink/80 hover:bg-sand/70 hover:text-brick"}`}
                role="option" aria-selected={highlight === i}>
                <Search size={13} className="text-ink/55" /> {s}
              </button>
            ))}
          </div>
          <div className="border-t border-ink/10 p-4">
            <p className="stamp !text-[10px] text-ink/60">Popular right now</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {popularSearches.map(([label, count], j) => {
                const idx = recentSearches.length + j;
                return (
                  <button key={label} id={`sug-${idx}`} onMouseDown={(e) => { e.preventDefault(); go(label); }}
                    className={`inline-flex items-center gap-2 border px-3 py-2 stamp !text-[11px] transition-colors ${highlight === idx ? "border-brick text-brick" : "border-ink/15 text-ink/75 hover:border-brick hover:text-brick"}`}
                    role="option" aria-selected={highlight === idx}>
                    {label} <span className="text-brick">{count}</span>
                  </button>
                );
              })}
            </div>
            <p className="stamp mt-3 !text-[9px] text-ink/60">Counts are illustrative · use ↑↓ and Enter</p>
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="stamp !text-[10px] text-cream/60">{t.hero.beginWith}</span>
        {["Paldi", "Thaltej", "Navrangpura", "Bopal"].map((l) => (
          <Link key={l} href={`/search?q=${encodeURIComponent(l)}`} className="border border-cream/25 px-3 py-1.5 stamp !text-[11px] text-cream/85 transition-colors hover:border-ember hover:text-ember">{l}</Link>
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
      <section className="relative min-h-[100svh] overflow-hidden bg-night text-cream">
        <div className="grain absolute inset-0">
          <Pic name="hero-ahmedabad" alt="Brick architecture of Ahmedabad glowing at golden hour" className="hero-zoom h-full w-full object-cover opacity-75" sizes="100vw" eager />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(21,17,13,0.92)_0%,rgba(21,17,13,0.55)_48%,rgba(21,17,13,0.15)_100%)]" />
        <div className="relative z-10 container flex min-h-[100svh] flex-col justify-end pb-16 pt-36 md:pb-20">
          <p className="kicker fade-rise text-ember" style={{ "--d": "150ms" } as React.CSSProperties}>{t.hero.kicker}</p>
          <h1 className="display mt-8 text-[clamp(52px,9.2vw,132px)] text-cream">
            <span className="mask-line"><span style={{ "--d": "250ms" } as React.CSSProperties}>{t.hero.h1a}<em className="text-ember">{t.hero.h1em}</em></span></span>
            <span className="mask-line"><span style={{ "--d": "380ms" } as React.CSSProperties}>{t.hero.h1b}</span></span>
          </h1>
          <p className="fade-rise mt-8 max-w-[460px] text-[15px] leading-7 text-cream/70 md:text-base" style={{ "--d": "560ms" } as React.CSSProperties}>
            {t.hero.sub}
          </p>
          <div className="mt-10">
            <HeroSearch />
          </div>
          <div className="fade-rise mt-14 flex flex-wrap items-end justify-between gap-6 border-t border-cream/20 pt-6" style={{ "--d": "850ms" } as React.CSSProperties}>
            <div className="flex gap-10 md:gap-16">
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={281} /></p><p className="stamp mt-1 !text-[10px] text-cream/65">verified homes</p></div>
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={14} /></p><p className="stamp mt-1 !text-[10px] text-cream/65">localities mapped</p></div>
              <div><p className="font-display text-3xl font-medium tracking-[-0.02em] text-cream md:text-4xl"><NumberTicker value={100} suffix="%" /></p><p className="stamp mt-1 !text-[10px] text-cream/65">RERA-checked</p></div>
            </div>
            <p className="hidden items-center gap-2 stamp !text-[10px] text-cream/60 md:flex"><ArrowDown size={13} className="animate-bounce" /> {t.hero.scroll}</p>
          </div>
          <p className="fade-rise mt-3 stamp !text-[9px] text-cream/60" style={{ "--d": "950ms" } as React.CSSProperties}>{t.hero.demoNote}</p>
        </div>
      </section>

      {/* ================= TICKER ================= */}
      <div className="border-b border-ink/12 bg-brick py-3.5 text-cream" aria-hidden="true">
        <Marquee speed={34}>
          {tickerItems.map((item) => (
            <span key={item} className="flex items-center stamp !text-[12px] font-medium">
              <span className="px-6">{item}</span><span className="text-ember">✦</span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* ================= WORD REVEAL MANIFESTO ================= */}
      <section className="container py-24 md:py-32">
        <p className="kicker text-brick">The Architech way</p>
        <WordReveal
          text="Most portals show you a listing. We show you a life — the street, the trees, the school run, the RERA record, and the date every fact was last checked. Kahn built this city arches that hide nothing. Neither do we."
          className="display mt-8 max-w-[1080px] text-[clamp(28px,4.2vw,58px)] text-ink"
        />
      </section>

      {/* ================= BENTO GRID ================= */}
      <section className="border-y border-ink/12 bg-sand/60 py-20 md:py-28">
        <div className="container">
          <Reveal className="flex items-end justify-between gap-6">
            <h2 className="display text-[clamp(30px,3.8vw,52px)]">Built different, <em className="text-brick">on purpose</em>.</h2>
            <p className="stamp hidden !text-[11px] text-ink/60 md:block">04 reasons · 01 city</p>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3 md:grid-rows-2">
            {/* Big trust tile with border beam */}
            <Reveal className="md:col-span-2 md:row-span-2">
              <div className="border-beam h-full bg-night">
                <div className="grain relative flex h-full min-h-[420px] flex-col justify-end overflow-hidden bg-night p-8 text-cream md:p-10">
                  <Pic name="brick-arch" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" sizes="(max-width: 768px) 100vw, 66vw" />
                  <div className="relative z-10">
                    <span className="grid h-12 w-12 place-items-center rounded-t-full bg-trust text-cream"><ShieldCheck size={20} /></span>
                    <h3 className="display mt-6 max-w-[440px] text-[clamp(26px,3vw,42px)] text-cream">Every fact carries its <em className="text-ember">evidence</em>.</h3>
                    <p className="mt-4 max-w-[400px] text-sm leading-7 text-cream/70">RERA registration on the page. Source trail in view. Freshness stamped on every price. If we can't verify it, we don't publish it.</p>
                    <p className="stamp mt-6 !text-[10px] text-ember">GJ/RERA/AHMEDABAD · re-checked on every update</p>
                  </div>
                </div>
              </div>
            </Reveal>
            {/* Locality intelligence tile */}
            <Reveal delay={100}>
              <div className="flex h-full min-h-[200px] flex-col justify-between border border-ink/12 bg-card p-7 motion-lift hover:editorial-shadow">
                <Compass size={20} className="text-brick" />
                <div>
                  <h3 className="font-display text-2xl font-medium tracking-[-0.02em]">Place before address</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/60">Locality notes built from public records and OpenStreetMap — streets, schools, gardens, distances.</p>
                </div>
              </div>
            </Reveal>
            {/* Freshness tile with live ticker */}
            <Reveal delay={180}>
              <div className="flex h-full min-h-[200px] flex-col justify-between border border-ink/12 bg-card p-7 motion-lift hover:editorial-shadow">
                <div className="flex items-center justify-between">
                  <Timer size={20} className="text-brick" />
                  <span className="stamp flex items-center gap-1.5 !text-[10px] text-trust"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-trust" /> live (demo)</span>
                </div>
                <div>
                  <p className="font-display text-4xl font-medium tracking-[-0.02em]"><NumberTicker value={37} /></p>
                  <h3 className="mt-1 font-display text-lg font-medium tracking-[-0.01em]">facts re-verified today</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/60">Stale data announces itself — and gets withdrawn.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= FEATURED HOMES (tilt cards) ================= */}
      <section className="container py-24 md:py-32">
        <Reveal className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="kicker text-brick">{t.sections.curatedKicker}</p>
            <h2 className="display mt-6 max-w-[640px] text-[clamp(34px,4.4vw,60px)]">Homes worth <em className="text-brick">returning</em> to.</h2>
          </div>
          <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">All 281 homes <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {properties.map((property, i) => (
            <Reveal key={property.id} delay={i * 90}>
              <TiltCard><PropertyCard property={property} index={i} arch={i === 0} /></TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

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
            {localities.map((place, i) => (
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

      {/* ================= METHOD / STEPWELL ================= */}
      <section className="grain bg-night py-24 text-cream md:py-36">
        <div className="container grid gap-16 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <Reveal>
            <figure className="relative mx-auto max-w-[400px]">
              <div className="arch-frame img-hover">
                <Pic name="stepwell" alt="Descending stone geometry of the Adalaj stepwell" className="aspect-[3/4] w-full object-cover" sizes="(max-width: 768px) 100vw, 40vw" />
              </div>
              <figcaption className="mt-4 flex items-center justify-between stamp !text-[10px] text-cream/60">
                <span>Study 02 — Adalaj ni Vav, depth in layers</span><span>EST. 1499</span>
              </figcaption>
            </figure>
          </Reveal>
          <Reveal delay={120}>
            <p className="kicker text-ember">Our method</p>
            <h2 className="display mt-7 max-w-[540px] text-[clamp(34px,4.4vw,60px)] text-cream">Trust is a structure. We build it in <em className="text-ember">layers</em>.</h2>
            <div className="mt-12 space-y-0 border-t border-cream/15">
              {[
                ["01", "Locality context", "Street rhythm, access, schools, and everyday cues — gathered before a single listing is shown."],
                ["02", "Source review", "RERA registration, partner evidence, and document trails held in view, never behind a wall."],
                ["03", "Freshness signal", "Every fact is stamped with when it was last checked. Stale data announces itself."],
              ].map(([num, title, body]) => (
                <div key={num} className="group grid grid-cols-[64px_1fr] gap-5 border-b border-cream/15 py-7 md:grid-cols-[90px_1fr]">
                  <span className="index-num text-[34px] text-ember/80 md:text-[44px]">{num}</span>
                  <div>
                    <p className="font-display text-xl font-medium tracking-[-0.01em] md:text-2xl">{title}</p>
                    <p className="mt-2 max-w-[430px] text-sm leading-6 text-cream/60">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/guide" className="mt-9 inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-ember link-rail">Read the full methodology <ArrowUpRight size={15} /></Link>
          </Reveal>
        </div>
      </section>

      {/* ================= TESTIMONIAL RAILS ================= */}
      <section className="overflow-hidden border-b border-ink/12 py-20 md:py-28">
        <div className="container mb-12">
          <Reveal>
            <p className="kicker text-brick">Word on the street</p>
            <h2 className="display mt-6 text-[clamp(30px,3.8vw,52px)]">Trust, <em className="text-brick">earned</em> and repeated.</h2>
            <p className="stamp mt-4 !text-[10px] text-ink/60">Illustrative voices for this concept preview — real reviews arrive with the live platform.</p>
          </Reveal>
        </div>
        <div className="space-y-5">
          <Marquee speed={46}>
            {testimonials.slice(0, 3).map((t) => (
              <blockquote key={t.name} className="mx-2.5 w-[380px] shrink-0 border border-ink/12 bg-card p-6">
                <Quote size={16} className="text-brick" />
                <p className="mt-3 text-sm leading-6 text-ink/75">"{t.quote}"</p>
                <footer className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="stamp !text-[10px] text-trust">{t.role}</span>
                </footer>
              </blockquote>
            ))}
          </Marquee>
          <Marquee speed={52} reverse>
            {testimonials.slice(3).map((t) => (
              <blockquote key={t.name} className="mx-2.5 w-[380px] shrink-0 border border-ink/12 bg-card p-6">
                <Quote size={16} className="text-brick" />
                <p className="mt-3 text-sm leading-6 text-ink/75">"{t.quote}"</p>
                <footer className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="stamp !text-[10px] text-trust">{t.role}</span>
                </footer>
              </blockquote>
            ))}
          </Marquee>
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

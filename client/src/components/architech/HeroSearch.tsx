"use client";
/* Home hero search island. Kept as its own client module so the nationwide
   listing fixtures stay on the server (passed in as popular/preset props)
   instead of shipping in every visitor's first-load JavaScript. */
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketCategory, MarketIntent } from "@/lib/filters";
import SuggestRow from "@/components/architech/SuggestRow";
import { useSuggestCombobox } from "@/components/architech/useSuggestCombobox";
import type { SearchSuggestion } from "@/lib/search/suggestion-types";
import { readRecentSearches, rememberRecentSearch } from "@/lib/search/recent";
import { useLang } from "@/contexts/LangContext";

type HeroIntent = MarketIntent;
type HeroCategory = Exclude<MarketCategory, "all">;

export type HeroSearchCity = { slug: string; name: string };
export type HeroPreset = { query: string; label: string };

export default function HeroSearch({
  cities,
  popularSearches,
  heroPresets,
  example,
}: {
  cities: HeroSearchCity[];
  popularSearches: SearchSuggestion[];
  heroPresets: HeroPreset[];
  example: string;
}) {
  const router = useRouter();
  const navigate = (url: string) => router.push(url);
  const { t } = useLang();
  const [intent, setIntent] = useState<HeroIntent>("buy");
  const [category, setCategory] = useState<HeroCategory>("residential");
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const queryLen = query.trim().length;
  const [resultCount, setResultCount] = useState<number | null>(null);

  const buildParams = useMemo(() => {
    const p = new URLSearchParams();
    if (intent !== "buy") p.set("intent", intent);
    if (category !== "residential") p.set("category", category);
    return p;
  }, [intent, category]);

  const go = (q: string, href?: string) => {
    const trimmed = q.trim();
    if (trimmed) rememberRecentSearch(trimmed);
    if (href) { navigate(href); return; }

    const p = new URLSearchParams(buildParams);
    if (trimmed) p.set("q", trimmed);
    navigate(`/search?${p.toString()}`);
  };

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recents, setRecents] = useState<SearchSuggestion[]>([]);

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
  }, [query, recents, popularSearches]);

  useEffect(() => {
    const trimmed = query.trim();
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const p = new URLSearchParams(buildParams);
        if (trimmed) p.set("q", trimmed);
        const r = await fetch(`/api/search/${p.toString() ? `?${p}` : ""}`, { signal: ctrl.signal });
        const data = await r.json() as { count?: number };
        if (typeof data.count === "number") setResultCount(data.count);
      } catch {
        setResultCount(null);
      }
    }, 220);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [buildParams, query]);

  const options = query.trim().length === 0 ? [...recents, ...popularSearches] : suggestions;

  const sug = useSuggestCombobox({
    query,
    suggestions: options,
    openWhenEmpty: true,
    commit: (q, href) => go(q, href),
  });
  const inputRef = sug.inputRef;

  const setIntentAndFocus = (v: HeroIntent) => { setIntent(v); inputRef.current?.focus(); };

  const intentLabel = intent === "rent" ? t.hero.rent : t.hero.buy;
  const categoryLabel = category === "residential" ? "homes" : category === "pg" ? "PG / co-living" : category;
  const searchContext = `${intentLabel} ${categoryLabel} in`;

  return (
    <div ref={wrapRef} className="fade-rise relative w-full max-w-[700px]" style={{ "--d": "560ms" } as React.CSSProperties}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-2xl border border-cream/25 bg-paper/10 p-1 backdrop-blur-md" role="tablist" aria-label="Buy or rent">
          {(["buy", "rent"] as HeroIntent[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setIntentAndFocus(v)}
              role="tab"
              aria-selected={intent === v}
              className={`relative rounded-xl px-6 py-2.5 stamp font-semibold transition-all duration-300 ${intent === v ? "text-cream" : "text-cream/60 hover:text-cream"}`}
            >
              {intent === v && <span className="absolute inset-0 rounded-xl bg-brick" aria-hidden="true" />}
              <span className="relative z-10">{v === "buy" ? t.hero.buy : t.hero.rent}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["residential", "commercial", "pg", "plot", "land", "auction"] as HeroCategory[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setCategory(c); }}
              aria-pressed={category === c}
              className={`rounded-full px-3 py-1.5 stamp font-semibold transition-colors duration-200 ${category === c ? "bg-cream/20 text-cream ring-1 ring-cream/30" : "text-cream/55 hover:bg-cream/10 hover:text-cream"}`}
            >
              {c === "residential" ? t.hero.buy : c}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); go(query); }}
        className="search-composer field-shell [--field-focus:var(--ember)] mt-3 flex items-stretch rounded-2xl border border-cream/25 bg-paper/10 backdrop-blur-md transition-all duration-300 focus-within:border-ember focus-within:bg-paper/20 focus-within:shadow-[0_14px_40px_rgba(0,0,0,0.32)]"
        role="search" aria-label={`Search ${intentLabel} across India`}>
        <span className="grid w-14 shrink-0 place-items-center border-r border-cream/15 text-cream/60 sm:w-[150px] sm:justify-items-start sm:px-4"><span className="hidden sm:block"><span className="block stamp text-cream/45">{searchContext}</span><span className="mt-1 block font-display text-sm text-cream/90">All India</span></span><Search size={19} className="sm:hidden" /></span>
        <input
          value={query} onChange={(e) => { setQuery(e.target.value); }}
          placeholder={`Try “${example}”, a PIN code, or any city…`}
          className="w-full bg-transparent py-4 pl-4 pr-2 text-[15px] text-cream placeholder:text-cream/60 focus:outline-none focus-visible:bg-transparent focus-visible:ring-0"
          aria-label={`Search ${intentLabel} by locality, project, or BHK`}
          {...sug.inputProps}
        />
        <button type="submit" className="clay-fill shimmer-btn motion-press mx-1.5 my-1.5 inline-flex items-center justify-center rounded-xl bg-brick px-6 text-center stamp !text-[12px] font-semibold text-cream transition-colors hover:bg-brick-deep">{t.hero.search}</button>
      </form>

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
          <p role="group" aria-label="Search keyboard help" className="stamp border-t border-ink/10 px-4 py-2.5 text-ink/50">↑↓ to move · Enter to search · Esc to close{resultCount !== null ? ` · ${resultCount} ${intentLabel} match${resultCount === 1 ? "" : "es"} for this scope` : ""}</p>
        </div>
      </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="stamp text-cream/60">{t.hero.beginWith}</span>
        {cities.slice(0, 4).map((city) => (
          <Link
            key={city.slug}
            href={`/search?q=${encodeURIComponent(city.name)}&${buildParams.toString()}`}
            className="rounded-full border border-cream/25 px-3 py-1.5 stamp text-cream/85 transition-all duration-200 hover:-translate-y-0.5 hover:border-ember hover:bg-cream/10 hover:text-ember"
          >{city.name}</Link>
        ))}
        <span className="mx-1 h-4 w-px bg-cream/20" aria-hidden="true" />
        {heroPresets.map((preset) => (
          <button key={preset.query} type="button" onClick={() => { setQuery(preset.query); go(preset.query); }} className="rounded-full border border-cream/15 px-3 py-1.5 stamp text-cream/65 transition-all duration-200 hover:-translate-y-0.5 hover:border-ember hover:text-ember">{preset.label}</button>
        ))}
      </div>
    </div>
  );
}

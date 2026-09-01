"use client";
/* Home hero search island. Kept as its own client module so the nationwide
   listing fixtures stay on the server (passed in as popular/preset props)
   instead of shipping in every visitor's first-load JavaScript. */
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketIntent } from "@/lib/filters";
import SuggestRow from "@/components/architech/SuggestRow";
import { useSuggestCombobox } from "@/components/architech/useSuggestCombobox";
import type { SearchSuggestion } from "@/lib/search/suggestion-types";
import { readRecentSearches, rememberRecentSearch } from "@/lib/search/recent";
import { useLang } from "@/contexts/LangContext";

type HeroIntent = MarketIntent;

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
  const [newProjects, setNewProjects] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const queryLen = query.trim().length;
  const [resultCount, setResultCount] = useState<number | null>(null);

  const buildParams = useMemo(() => {
    const p = new URLSearchParams();
    if (intent !== "buy") p.set("intent", intent);
    if (newProjects) p.set("filters", "availability-new");
    return p;
  }, [intent, newProjects]);

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
  const searchContext = `${intentLabel} homes in`;

  return (
    <div ref={wrapRef} className="fade-rise relative w-full max-w-[700px]" style={{ "--d": "560ms" } as React.CSSProperties}>
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
          placeholder={`Try “${example}”, a PIN code, or any city…`}
          className="hero-read w-full bg-transparent py-4 pl-4 pr-2 text-[15px] text-cream placeholder:text-cream/80 focus:outline-none focus-visible:bg-transparent focus-visible:ring-0"
          aria-label={`Search ${intentLabel} by locality, project, or BHK`}
          {...sug.inputProps}
        />
        <button type="submit" className="clay-fill shimmer-btn motion-press btn-primary mx-1.5 my-1.5 inline-flex items-center justify-center border border-white/15 bg-brick px-6 text-center stamp !text-[12px] font-semibold text-cream transition-colors hover:bg-brick-deep">{t.hero.search}</button>
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

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="glass-chip rounded-full px-3 py-1.5 stamp !text-[12px]">{t.hero.beginWith}</span>
        {cities.slice(0, 4).map((city) => (
          <Link
            key={city.slug}
            href={`/search?q=${encodeURIComponent(city.name)}&${buildParams.toString()}`}
            className="glass-chip rounded-full px-3 py-1.5 stamp !text-[12px] hover:-translate-y-0.5"
          >{city.name}</Link>
        ))}
        <span className="mx-1 h-4 w-px bg-cream/30" aria-hidden="true" />
        {heroPresets.map((preset) => (
          <button key={preset.query} type="button" onClick={() => { setQuery(preset.query); go(preset.query); }} className="glass-chip rounded-full px-3 py-1.5 stamp !text-[12px] hover:-translate-y-0.5">{preset.label}</button>
        ))}
      </div>
    </div>
  );
}

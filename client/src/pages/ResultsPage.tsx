"use client";
/* ARCHITECH — Search results v4.
   Filters are multi-select (AND), synced to the URL for back-button + sharing.
   Real sort control, honest counts, aria-live announcements, skeletons, bottom-sheet on mobile. */
import { ArrowUpRight, LayoutList, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import PropertyCard from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import useTitle from "../hooks/useTitle";
import { makeFilters, parseFilterParam, serializeFilters, type SortId } from "@/lib/filters";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { useLang } from "@/contexts/LangContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Property } from "@/lib/repositories";
import { searchListings, type SearchResponse } from "@/lib/search/search";
import MapListSync from "@/components/architech/MapListSync";
import { useSearchSuggestions } from "@/components/architech/useSearchSuggestions";

const filterDefs = makeFilters<Property>();
const trending = ["3 BHK in Paldi", "Courtyard homes", "New launches in Bopal", "Under ₹1 Cr"];

function SkeletonCard() {
  return (
    <div className="border border-ink/12 bg-card" aria-hidden="true">
      <div className="skeleton aspect-[1.25]" />
      <div className="space-y-3 p-5 md:p-6">
        <div className="flex justify-between"><div className="skeleton h-7 w-24" /><div className="skeleton h-4 w-16" /></div>
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-full" />
      </div>
    </div>
  );
}

function FilterChips({ active, onToggle, vertical = false }: { active: string[]; onToggle: (id: string) => void; vertical?: boolean }) {
  const { t } = useLang();
  return (
    <div className={vertical ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"} role="group" aria-label={t.search.filtersGroup}>
      {filterDefs.map((f) => {
        const on = active.includes(f.id);
        return (
          <button key={f.id} onClick={() => onToggle(f.id)} aria-pressed={on}
            className={`touch-44 px-4 stamp !text-[11px] font-semibold transition-all duration-200 ${vertical ? "w-full text-left py-3.5" : "py-2.5"} ${on ? "bg-brick text-cream" : "border border-ink/20 text-ink/70 hover:border-brick hover:text-brick"}`}>
            {t.search.filters[f.id] ?? f.label}{on && <X size={12} className="ml-2 inline" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export default function ResultsPage() {
  useTitle("Search homes in Ahmedabad");
  const { t } = useLang();
  const sp = useSearchParams();
  const router = useRouter();
  const searchStr = sp.toString();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const active = useMemo(() => parseFilterParam(params.get("filters")), [params]);
  const sort = (params.get("sort") as SortId) || "fresh";
  const query = params.get("q") ?? "";

  const [mapMode, setMapMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeKey = active.join(",");
  const initialSearch = useMemo(() => searchListings({ q: query, filters: active, sort }), [activeKey, query, sort]);
  const [searchResponse, setSearchResponse] = useState<SearchResponse>(initialSearch);

  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (active.length) p.set("filters", serializeFilters(active));
    if (sort !== "fresh") p.set("sort", sort);

    let cancelled = false;
    setLoading(true);
    fetch(`/api/search/${p.toString() ? `?${p}` : ""}`)
      .then((response) => { if (!response.ok) throw new Error(`Search API ${response.status}`); return response.json() as Promise<SearchResponse>; })
      .then((data) => { if (!cancelled) setSearchResponse(data);
        setSelectedId((current) => current && data.results.some((property) => property.id === current) ? current : data.results[0]?.id ?? null); })
      .catch(() => { if (!cancelled) setSearchResponse(initialSearch);
        setSelectedId((current) => current && initialSearch.results.some((property) => property.id === current) ? current : initialSearch.results[0]?.id ?? null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeKey, initialSearch, query, sort]);

  const results = searchResponse.results;

  const updateUrl = (nextFilters: string[], nextSort: SortId = sort) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (nextFilters.length) p.set("filters", serializeFilters(nextFilters));
    if (nextSort !== "fresh") p.set("sort", nextSort);
    router.replace(`/search/${p.toString() ? `?${p}` : ""}`, { scroll: false });

  };

  const toggleFilter = (id: string) => updateUrl(active.includes(id) ? active.filter((f) => f !== id) : [...active, id]);
  const clearFilters = () => { setDrawerOpen(false); updateUrl([]); };
  const filterSummary = active.length ? filterDefs.filter((f) => active.includes(f.id)).map((f) => t.search.filters[f.id] ?? f.label).join(" + ") : t.search.allHomes;

  const [savingSearch, setSavingSearch] = useState(false);

  // Server-backed quick search (debounced, abortable) for refining the query.
  const [qInput, setQInput] = useState(query);
  const [qFocused, setQFocused] = useState(false);
  const { suggestions: qSuggestions } = useSearchSuggestions(qInput);
  useEffect(() => { setQInput(query); }, [query]);
  const runQuery = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const p = new URLSearchParams(searchStr);
    p.set("q", trimmed);
    router.replace(`/search?${p.toString()}`, { scroll: false });
    setQInput(trimmed);
    setQFocused(false);
  };

  const saveSearch = async () => {
    if (savingSearch) return;
    setSavingSearch(true);
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, filters: active, sort, notify: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" ") ?? "Could not save this search.");
      toast(t.search.searchSavedToast, { description: payload.duplicate ? t.search.searchSavedDuplicate : t.search.searchSavedDescription });
    } catch {
      toast(t.search.searchSaveFailed, { description: t.common.demoData });
    } finally {
      setSavingSearch(false);
    }
  };

  return (
    <div className="bg-paper pt-[78px] text-ink">
      {/* Header */}
      <section className="border-b border-ink/12 bg-sand/70 py-12 md:py-16">
        <div className="container">
          <p className="kicker text-brick">{t.search.kicker} · {t.common.ahmedabad}{query ? ` · “${query}”` : ""}</p>
          {query && <button onClick={() => { const p = new URLSearchParams(searchStr); p.delete("q"); router.replace(`/search/${p.toString() ? `?${p}` : ""}`, { scroll: false }); }} className="mt-3 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-ink/60 underline underline-offset-4 hover:text-brick">{t.search.clearSearch} “{query}” <X size={12} /></button>}
          <div className="mt-6 max-w-[560px]">
            <div className="relative">
              <form onSubmit={(e) => { e.preventDefault(); runQuery(qInput); }} className="flex items-stretch border border-ink/20 bg-paper focus-within:border-brick" role="search" aria-label="Search homes">
                <span className="grid w-12 place-items-center text-ink/55"><Search size={16} /></span>
                <input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  onFocus={() => setQFocused(true)}
                  onBlur={() => setQFocused(false)}
                  className="w-full bg-transparent px-2 py-3 text-sm focus:outline-none"
                  placeholder={t.hero.placeholderBuy}
                  aria-label={t.search.kicker}
                />
                <button type="submit" className="btn-sweep touch-44 m-1.5 bg-brick px-5 stamp !text-[11px] font-semibold text-cream">{t.hero.search}</button>
              </form>
              {qFocused && qSuggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-30 mt-1 border border-ink/15 bg-paper text-ink editorial-shadow" role="listbox" aria-label="Search suggestions">
                  {qSuggestions.map((s, i) => (
                    <button key={`${s.kind}-${i}`} onMouseDown={(e) => { e.preventDefault(); runQuery(s.query); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink/80 hover:bg-sand/70 hover:text-brick" role="option" aria-selected={false}>
                      <Search size={12} className="text-ink/55" /> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <h1 className="display text-[clamp(36px,5vw,68px)]">{results.length} {results.length === 1 ? t.search.home : t.search.homes} {t.search.title1} <em className="text-brick">{t.search.cityName}</em></h1>
            <div className="flex gap-2">
              <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerTrigger asChild>
                  <button className="touch-44 inline-flex items-center gap-2 border border-ink/20 px-4 stamp !text-[11px] font-semibold transition-colors hover:border-brick hover:text-brick md:hidden">
                    <SlidersHorizontal size={14} /> {t.search.filtersButton} {active.length > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-brick text-[10px] text-cream">{active.length}</span>}
                  </button>
                </DrawerTrigger>
                <DrawerContent className="border-t-2 border-brick bg-paper">
                  <DrawerHeader className="text-left">
                    <DrawerTitle className="font-display text-2xl font-medium tracking-[-0.02em]">{t.search.filterHomes}</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-8">
                    <FilterChips active={active} onToggle={toggleFilter} vertical />
                    {active.length > 0 && <button onClick={clearFilters} className="touch-44 mt-3 w-full border border-ink/20 py-3 stamp !text-[11px] font-semibold text-ink/70">{t.search.clearAll}</button>}
                    <DrawerClose asChild>
                      <button className="touch-44 mt-4 w-full bg-night py-3.5 stamp !text-[12px] font-semibold text-cream">{t.search.showHomes} · {results.length}</button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <button onClick={() => setMapMode(!mapMode)} className="touch-44 inline-flex items-center gap-2 border border-ink/20 px-4 stamp !text-[11px] font-semibold transition-colors hover:border-brick hover:text-brick lg:hidden" aria-pressed={mapMode}>
                {mapMode ? <><LayoutList size={14} /> {t.search.list}</> : <><MapIcon size={14} /> {t.search.map}</>}
              </button>
            </div>
          </div>
          {/* Desktop: multi-select chips + sort */}
          <div className="mt-8 hidden flex-wrap items-center gap-2 md:flex">
            <span className="mr-2 flex items-center gap-1.5 stamp !text-[10px] text-ink/60"><SlidersHorizontal size={12} /> {t.search.filter}</span>
            <FilterChips active={active} onToggle={toggleFilter} />
            {active.length > 0 && <button onClick={clearFilters} className="touch-44 px-3 stamp !text-[11px] font-semibold text-ink/60 underline underline-offset-4 hover:text-brick">{t.search.clearAll}</button>}
            <div className="ml-auto flex items-center gap-2">
              <span className="stamp !text-[10px] text-ink/60">{t.search.sort}</span>
              <Select value={sort} onValueChange={(v) => updateUrl(active, v as SortId)}>
                <SelectTrigger aria-label={t.search.sortHomes} className="h-11 w-[190px] rounded-none border-ink/20 bg-transparent stamp !text-[11px] font-semibold">
                  <SelectValue placeholder={t.search.sortFresh} />
                </SelectTrigger>
                <SelectContent className="rounded-none border-ink/15 bg-paper">
                  <SelectItem value="fresh">{t.search.sortFresh}</SelectItem>
                  <SelectItem value="price-asc">{t.search.sortAsc}</SelectItem>
                  <SelectItem value="price-desc">{t.search.sortDesc}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Results + map */}
      <section className="container py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className={mapMode ? "hidden lg:block" : ""}>
            <div className="mb-7 flex items-center justify-between border-b border-ink/10 pb-4">
              <p className="stamp !text-[11px] text-ink/60" aria-live="polite" role="status">
                {loading ? t.search.updating : `${results.length} ${results.length === 1 ? t.search.home : t.search.homes} · ${filterSummary}`}
              </p>
              <p className="stamp hidden !text-[11px] text-trust sm:block">{t.search.demoFixtures}</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2" aria-busy={loading}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : results.map((property, i) => (
                    <Reveal key={`${active.join()}-${sort}-${property.id}`} delay={i * 60}>
                      <div id={`listing-${property.id}`} onMouseEnter={() => setSelectedId(property.id)} onFocus={() => setSelectedId(property.id)} className={selectedId === property.id ? "ring-2 ring-brick ring-offset-4 ring-offset-paper" : undefined}>
                        <PropertyCard property={property} index={i} />
                      </div>
                    </Reveal>
                  ))}
            </div>
            {/* Curated empty state */}
            {!loading && results.length === 0 && (
              <div className="border border-dashed border-ink/25 p-10 text-center md:p-14">
                <p className="font-display text-3xl tracking-[-0.02em]">{query ? <>{t.search.noHomesYet} “{query}” {active.length > 0 ? t.search.withFilters : ""} — <em className="text-brick">{t.search.yet}</em>.</> : <>{t.search.noCombination} — <em className="text-brick">{t.search.yet}</em>.</>}</p>
                <p className="mx-auto mt-3 max-w-[380px] text-sm leading-6 text-ink/60">{t.search.emptyHelp}</p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {trending.map((t) => (
                    <button key={t} onClick={clearFilters} className="touch-44 border border-ink/20 px-4 stamp !text-[11px] font-semibold text-ink/70 transition-colors hover:border-brick hover:text-brick">{t}</button>
                  ))}
                </div>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button onClick={() => void saveSearch()} disabled={savingSearch} className="touch-44 bg-brick px-6 stamp !text-[11px] font-semibold text-cream disabled:cursor-wait disabled:opacity-60">{savingSearch ? "…" : t.search.saveSearch}</button>
                  <Link href="/guide" className="touch-44 inline-flex items-center gap-1.5 px-4 py-3 stamp !text-[11px] font-semibold text-brick">{t.search.readGuides} <ArrowUpRight size={13} /></Link>
                </div>
              </div>
            )}
            {!loading && results.length > 0 && (
              <div className="mt-12 flex items-center justify-between border-t border-ink/10 pt-6">
                <span className="stamp !text-[11px] text-ink/60">{t.search.showingAll} {results.length} {t.search.demoInventorySuffix}</span>
              </div>
            )}
          </div>

          {/* MapLibre map/list synchronized aside */}
          <MapListSync
            listings={results}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className={`${mapMode ? "block" : "hidden lg:block"} lg:sticky lg:top-[102px] lg:h-[calc(100vh-130px)]`}
            copy={{
              mapLabel: t.search.mapLabel,
              searchArea: t.search.searchArea,
              searchingArea: t.search.searchingArea,
              searchingAreaDescription: t.search.searchingAreaDescription,
              liveCartography: t.search.liveCartography,
              mapCopy: t.search.mapCopy,
            }}
          />
        </div>
      </section>
    </div>
  );
}

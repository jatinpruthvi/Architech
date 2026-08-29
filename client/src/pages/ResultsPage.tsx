"use client";
/* ARCHITECH — Search results v5 (facet rebuild).

 What changed from v4, and why each change is load-bearing:
 • Filters are GROUPED (OR within a group, AND across groups), each option
 carrying a live count. The old flat chip list AND'd every chip, so
 "2 BHK" + "3 BHK +" was unsatisfiable and returned an empty page.
 • Counts are computed with the counted group's own predicate removed, so a
 "(0)" means what the user thinks it means.
 • Applied state is live and sticky (no Apply button, no lost edits).
 • No skeleton flash: the old effect set `loading` on mount and listed
 `initialSearch` (a fresh object identity per render) in its deps, so every
 visit re-drew skeletons over already-correct server-rendered results.
 • The stagger no longer re-triggers on filter change and is capped, so a
 filter click doesn't cost ~1.4s of choreography.
 • Map mode is a real desktop mode (list collapses, map expands) instead of a
 `lg:hidden` toggle that was a no-op above the breakpoint.
 • The zero-result state is a ladder: relax the costliest constraint, widen to
 a locality with inventory, then capture the brief — pre-filled.
 Filter state lives in the URL, so back/forward and shared links still work,
 and pre-rebuild `?filters=2bhk,rera` links keep resolving. */
import { ArrowUpRight, Check, LayoutList, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import PropertyCard from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import FilterPanel, { AppliedFacetRow } from "../components/architech/FilterSurface";
import useTitle from "../hooks/useTitle";
import { type MarketCategory, type MarketIntent, type SortId } from "@/lib/filters";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { useLang } from "@/contexts/LangContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCities, getCityBySlug } from "@/lib/repositories";
import { parsePincode, resolvePincode, PINCODE_PROVENANCE } from "@/lib/pincodes";
import { applyParsedQueryToParams, describeParsedQuery, parseSearchQuery } from "@/lib/search/parse-query";
import { popularQueries } from "@/lib/search/suggest";
import { searchListings, type SearchResponse } from "@/lib/search/search";
import { activeFacetCount, facetGroups, groupsForProjection, parseFacetState, serializeFacetState, type FacetState } from "@/lib/search/facets";
import MapListSync from "@/components/architech/MapListSync";
import Pic from "@/components/architech/Pic";
import SuggestRow from "@/components/architech/SuggestRow";
import { useSearchSuggestions } from "@/components/architech/useSearchSuggestions";
import { useSuggestCombobox } from "@/components/architech/useSuggestCombobox";
import { rememberRecentSearch } from "@/lib/search/recent";
import { labelForFacing, labelForFurnishing, propertyFactRows } from "@/lib/listing-details";

function SkeletonCard() {
 return (
 <div className="border border-ink/12 bg-card" aria-hidden="true">
 <div className="skeleton aspect-[1.5]" />
 <div className="space-y-3 p-5 md:p-6">
 <div className="flex justify-between"><div className="skeleton h-7 w-24" /><div className="skeleton h-4 w-16" /></div>
 <div className="skeleton h-5 w-3/4" />
 <div className="skeleton h-4 w-1/2" />
 <div className="skeleton h-4 w-full" />
 </div>
 </div>
 );
}

export default function ResultsPage() {
 useTitle("Search homes across India");
 const { t, lang } = useLang();
 const sp = useSearchParams();
 const router = useRouter();
 const searchStr = sp.toString();
 const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);

 const query = params.get("q") ?? "";
 const category: MarketCategory = ["all", "residential", "commercial", "pg", "plot", "land", "auction"].includes(params.get("category") ?? "") ? (params.get("category") as MarketCategory) : "all";
 const intent: MarketIntent = params.get("intent") === "rent" ? "rent" : "buy";
 const sort = (params.get("sort") as SortId) || "fresh";
 // City scope: a known city slug narrows every result, "all" searches India.
 const citySlug = getCityBySlug(params.get("city") ?? undefined)?.slug ?? "all";
 const activeCity = citySlug === "all" ? undefined : getCityBySlug(citySlug);
 // PIN scope: narrows to localities serving the PIN; a malformed value is
 // dropped rather than returning an empty page.
 const pincode = parsePincode(params.get("pincode"));
 const pincodeMatch = pincode ? resolvePincode(pincode) : null;

 // Facet state is DERIVED from the URL, never held in component state — one
 // source of truth, so back/forward, sharing, and a reload agree.
 const groups = useMemo(() => groupsForProjection(facetGroups({ intent }), "consumer"), [intent]);
 const filterTokens = useMemo(() => (params.get("filters") ?? "").split(",").map((token) => token.trim()).filter(Boolean), [params]);
 const facetState: FacetState = useMemo(() => parseFacetState(filterTokens.join(","), groups), [filterTokens, groups]);
 const activeCount = activeFacetCount(facetState);

 const [mapMode, setMapMode] = useState(false);
 const [loading, setLoading] = useState(false);
 const [filterOpen, setFilterOpen] = useState(false);
 const [quickViewOpen, setQuickViewOpen] = useState(false);
 const [selectedId, setSelectedId] = useState<string | null>(null);

 /* Server-backed search. `searchListings` is the same predicate the server
 uses, so the SSR payload and the hydrated response cannot disagree. */
 const initialSearch = useMemo(
 () => searchListings({ q: query, city: citySlug, pincode: pincode ?? undefined, filters: filterTokens, category, intent, sort }),
 [category, citySlug, filterTokens, intent, pincode, query, sort],
 );
 const [searchResponse, setSearchResponse] = useState<SearchResponse>(initialSearch);
 // The response we have already consumed for this exact URL. Without this
 // guard the effect re-fetched on every render and flashed skeletons over
 // correct results — the single biggest contributor to "this search is slow".
 const consumedRef = useRef<string | null>(null);
 // Fallback snapshot for a failed API call, held in a ref so the fetch effect
 // reads the CURRENT value without listing a per-render object identity in its
 // deps (which re-fired the effect forever — the v4 skeleton flash).
 const fallbackRef = useRef(initialSearch);
 fallbackRef.current = initialSearch;

 useEffect(() => {
 if (consumedRef.current === searchStr) return;
 const p = new URLSearchParams(searchStr);
 let cancelled = false;
 // Only show skeletons when there is nothing trustworthy on screen yet.
 setLoading(consumedRef.current !== null);

 fetch(`/api/search/${p.toString() ? `?${p}` : ""}`)
 .then((response) => {
 if (!response.ok) throw new Error(`Search API ${response.status}`);
 return response.json() as Promise<SearchResponse>;
 })
 .then((data) => {
 if (cancelled) return;
 consumedRef.current = searchStr;
 setSearchResponse(data);
 setSelectedId((current) => (current && data.results.some((property) => property.id === current) ? current : data.results[0]?.id ?? null));
 })
 .catch(() => {
 if (cancelled) return;
 // Offline / API failure: keep the locally-computed results, which are
 // correct for the fixture source and stale-but-plausible otherwise.
 consumedRef.current = searchStr;
 setSearchResponse(fallbackRef.current);
 setSelectedId((current) => (current && fallbackRef.current.results.some((property) => property.id === current) ? current : fallbackRef.current.results[0]?.id ?? null));
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });

 return () => {
 cancelled = true;
 };
 }, [filterTokens, category, citySlug, intent, pincode, query, sort, searchStr]);

 const results = searchResponse.results;
 const facets = searchResponse.facets;
 const applied = searchResponse.applied;
 const relaxations = searchResponse.relaxations;
 const widening = searchResponse.widening;
 const selectedProperty = results.find((property) => property.id === selectedId) ?? null;
 const marketLabel = category === "all" ? (results.length === 1 ? t.search.home : t.search.homes) : category === "residential" ? "homes" : category === "pg" ? "PG / co-living spaces" : `${category} listings`;
 const intentLabel = intent === "rent" ? "to rent" : "to buy";

 /** One place that writes the URL, preserving params the page doesn't own.
 * v4 rebuilt the query string from scratch in three near-identical copies,
 * which silently dropped anything added elsewhere. */
 const patch = useCallback(
 (mutate: (next: URLSearchParams) => void, options?: { closeFilter?: boolean }) => {
 const p = new URLSearchParams(searchStr);
 mutate(p);
 if (options?.closeFilter) setFilterOpen(false);
 router.replace(`/search/${p.toString() ? `?${p}` : ""}`, { scroll: false });
 },
 [router, searchStr],
 );

 const setFacetState = (next: FacetState) => {
 const serialised = serializeFacetState(next);
 patch((p) => {
 if (serialised) p.set("filters", serialised);
 else p.delete("filters");
 });
 };
 const removeFacet = (groupId: string, valueId: string) => {
 const next: FacetState = { multi: { ...facetState.multi }, ranges: { ...facetState.ranges } };
 // Range chips carry their `from-to` as the value id, so recognising that
 // shape is what distinguishes "clear the budget" from "deselect one value".
 const rangeMatch = /^(\d+)-(\d+)$/.exec(valueId);
 if (rangeMatch && groupId in next.ranges) {
 delete next.ranges[groupId];
 } else if (next.multi[groupId]) {
 const values = next.multi[groupId].filter((id) => id !== valueId);
 if (values.length) next.multi[groupId] = values;
 else delete next.multi[groupId];
 }
 setFacetState(next);
 };
 const clearFilters = () => setFacetState({ multi: {}, ranges: {} });
 const applyRelaxation = (groupId: string) => {
 const next: FacetState = { multi: { ...facetState.multi }, ranges: { ...facetState.ranges } };
 delete next.multi[groupId];
 delete next.ranges[groupId];
 setFacetState(next);
 };
 const applyWidening = (localitySlug: string) => {
 const next: FacetState = { multi: { ...facetState.multi, place: [...(facetState.multi.place ?? []), localitySlug] }, ranges: facetState.ranges };
 setFacetState(next);
 };
 const updateSort = (nextSort: SortId) => patch((p) => (nextSort === "fresh" ? p.delete("sort") : p.set("sort", nextSort)));
 const updateMarket = (nextIntent: MarketIntent, nextCategory: MarketCategory) =>
 patch((p) => {
 if (nextIntent === "rent") p.set("intent", "rent");
 else p.delete("intent");
 if (nextCategory !== "all") p.set("category", nextCategory);
 else p.delete("category");
 });
 /** Switching city keeps the query, market, filters and sort intact. */
 const updateCity = (nextCity: string) =>
 patch((p) => {
 if (nextCity === "all") p.delete("city");
 else p.set("city", nextCity);
 });

 const [savingSearch, setSavingSearch] = useState(false);

 /* Server-backed quick search (debounced, abortable) for refining the query.
 The panel is driven by the same combobox module the hero uses, so the keys,
 the aria wiring and the "what did I just select" state are one implementation
 and not two that can drift apart. */
 const selectSuggestion = useCallback((value: string, href?: string) => {
 const trimmed = value.trim();
 if (trimmed) rememberRecentSearch(trimmed);
 if (href) { router.push(href); return; }
 if (trimmed) runQueryRef.current(trimmed);
 }, [router]);

 /** Run a typed query. It is parsed into structured scope first — city, PIN,
 * intent, category and facets become real URL parameters — and anything a
 * parameter cannot carry stays as free text, so nothing typed is lost. */
 const runQuery = (value: string) => {
 const trimmed = value.trim();
 if (!trimmed) return;
 const parsed = parseSearchQuery(trimmed, citySlug);
 patch((p) => {
 const next = parsed.understood ? applyParsedQueryToParams(parsed, p) : (p.set("q", trimmed), p);
 // copy next into p
 p.forEach((_v, key) => {
 if (!next.has(key)) p.delete(key);
 });
 next.forEach((v, key) => p.set(key, v));
 });
 };

 const runQueryRef = useRef<(value: string) => void>(() => {});
 runQueryRef.current = runQuery;

 /* The page owns the text (it is also what the debounced fetch reads); the hook
 owns focus, highlight and the keys. */
 const [sugQuery, setSugQuery] = useState(query);
 useEffect(() => setSugQuery(query), [query]);
 const { suggestions: qSuggestions } = useSearchSuggestions(sugQuery, citySlug);
 const sug = useSuggestCombobox({
 query: sugQuery,
 suggestions: qSuggestions,
 commit: selectSuggestion,
 });

 /* What the box will do with the current text, shown before it runs. */
 const typedPreview = useMemo(() => {
 const trimmed = sugQuery.trim();
 if (trimmed.length < 3 || trimmed === query) return "";
 const parsed = parseSearchQuery(trimmed, citySlug);
 return parsed.understood ? describeParsedQuery(parsed) : "";
 }, [citySlug, sugQuery, query]);

 /* Recovery chips derived from real inventory in the active scope. */
 const trending = useMemo(() => popularQueries({ citySlug }, 4), [citySlug]);

 const saveSearch = async () => {
 if (savingSearch) return;
 setSavingSearch(true);
 try {
 const response = await fetch("/api/saved-searches", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ query, filters: filterTokens, sort, notify: true }),
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

 /* The requirement brief carries the active filters so nothing is retyped —
 for a product monetised by leads this is the highest-value hand-off on the
 page, and a pre-filled field is worth more than any amount of copy. */
 const briefHref = useMemo(() => {
 const p = new URLSearchParams();
 if (query) p.set("q", query);
 if (citySlug !== "all") p.set("city", citySlug);
 if (intent === "rent") p.set("intent", "rent");
 if (facetState.multi.place?.length) p.set("locality", facetState.multi.place[0]);
 if (facetState.multi.bhk?.length) p.set("bhk", facetState.multi.bhk[0].replace("+", ""));
 const budget = facetState.ranges.price;
 if (budget) p.set("budgetMax", String(budget.to));
 return `/requirements/?${p.toString()}`;
 }, [citySlug, facetState, intent, query]);
 const briefCarries = Boolean(query || citySlug !== "all" || intent === "rent" || activeCount > 0);

 const panel = (layout: "rail" | "sheet") => (
 <FilterPanel
 layout={layout}
 groups={groups}
 state={facetState}
 counts={facets}
 lang={lang}
 intent={intent}
 resultCount={results.length}
 onChange={setFacetState}
 onClear={clearFilters}
 onClose={() => setFilterOpen(false)}
 labels={{
 title: t.search.facet.title,
 hint: t.search.facet.hint,
 done: t.search.facet.done,
 noChange: t.search.facet.noChange,
 noChangeHint: t.search.facet.noChangeHint,
 localityNone: t.search.facet.localityNone,
 budget: t.search.facet.budget,
 budgetFrom: t.search.facet.budgetFrom,
 budgetTo: t.search.facet.budgetTo,
 histogramHint: t.search.facet.histogramHint,
 verifiedToggle: t.search.facet.verifiedToggle,
 verifiedHidden: t.search.facet.verifiedHidden,
 clearGroup: t.search.facet.clearGroup,
 }}
 />
 );

 return (
 <div className="bg-paper pt-[78px] text-ink">
 {/* Header */}
 <section className="border-b border-ink/12 bg-sand/70 py-12 md:py-16">
 <div className="container">
 <p className="ledger-stamp mb-4">AHM / DISCOVERY LEDGER / {intent === "rent" ? "RENT" : "BUY"} / {category === "all" ? "ALL INVENTORY" : category.toUpperCase()}</p>
 <p className="kicker text-brick">{t.search.kicker} · {t.common.ahmedabad}{query ? ` · “${query}”` : ""}</p>
 {query && (
 <button onClick={() => patch((p) => p.delete("q"))} className="mt-3 inline-flex items-center gap-1.5 stamp min-h-[36px] font-semibold ink-2 underline-offset-4 hover:text-brick">
 {t.search.clearSearch} “{query}” <X size={12} />
 </button>
 )}
<div className="mt-6 max-w-[560px]">
 <div className="relative">
 <form onSubmit={(e) => { e.preventDefault(); sug.submit(); }} className="field-shell flex items-stretch border border-ink/20 bg-paper focus-within:border-brick" role="search" aria-label="Search homes">
 <span className="grid w-12 place-items-center ink-2"><Search size={16} /></span>
 <input
 value={sugQuery}
 onChange={(event) => setSugQuery(event.target.value)}
 {...sug.inputProps}
 className="w-full bg-transparent px-2 py-3 text-sm focus:outline-none"
 placeholder={t.hero.placeholderBuy}
 aria-label={t.search.kicker}
 />
 <button type="submit" className="clay-fill btn-sweep touch-44 m-1.5 bg-brick px-5 stamp font-semibold text-cream">{t.hero.search}</button>
 </form>
 {/* The parser preview is the most trust-bearing line on the page —
 it says "here is what I understood", so it is typeset as a
 statement (13px sentence case, check rule) and not as 10px
 micro-caps in a 60%-opacity brown. */}
 {typedPreview && (
 <p className="mt-2 flex items-start gap-2 text-[13px] leading-5 text-ink">
 <Check size={13} className="mt-0.5 shrink-0 text-trust" aria-hidden="true" />
 <span><span className="ink-2">Reads as</span> {typedPreview}</span>
 </p>
 )}
 {sug.open && (
 <div
 ref={sug.listRef}
 id={sug.listId}
 role="listbox"
 aria-label="Search suggestions"
 className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden border border-ink/15 bg-paper text-ink editorial-shadow"
 >
 <div className="max-h-[320px] overflow-y-auto p-2">
 {sug.visible.map((option, index) => (
 <SuggestRow
 key={`${option.kind}-${option.query}-${index}`}
 option={option}
 index={index}
 id={`${sug.listId}-opt-${index}`}
 highlighted={sug.highlight === index}
 onHover={sug.optionHandlers.onHover}
 onSelect={sug.optionHandlers.onSelect}
 />
 ))}
 </div>
 <p className="hidden border-t border-ink/12 px-4 py-2.5 stamp ink-3 sm:flex sm:items-center sm:gap-3">
 <span>↑↓ to move</span><span aria-hidden="true">·</span><span>Enter to search</span><span aria-hidden="true">·</span><span>Esc to close</span>
 </p>
 </div>
 )}
 </div>
 </div>

 <div className="mt-5 flex flex-col gap-3 border-y border-ink/15 py-4 md:flex-row md:items-center md:gap-4">
 {/* City scope — the search is nationwide until a city is chosen. */}
 <div className="flex min-w-0 items-center gap-2">
 <label htmlFor="search-city" className="stamp shrink-0 ink-2">City</label>
 <select
 id="search-city"
 value={citySlug}
 onChange={(event) => updateCity(event.target.value)}
 className="touch-44 min-w-0 max-w-[190px] border border-ink/15 bg-transparent px-3 py-2 stamp font-semibold text-ink transition-colors hover:border-brick hover:text-brick focus:border-brick focus:outline-none"
 >
 <option value="all">All India</option>
 {getCities().map((option) => (
 <option key={option.slug} value={option.slug}>{option.name}</option>
 ))}
 </select>
 </div>
 <div className="flex gap-2" role="group" aria-label="Transaction type">
 {(["buy", "rent"] as MarketIntent[]).map((value) => (
 <button
 key={value}
 type="button"
 onClick={() => updateMarket(value, category)}
 aria-pressed={intent === value}
 className={`touch-44 rounded-lg px-4 py-2 stamp font-semibold transition-colors ${intent === value ? "border border-brick bg-sand text-ink" : "border border-transparent ink-2 hover:border-brick hover:text-brick"}`}
 >
 {value === "buy" ? "Buy" : "Rent"}
 </button>
 ))}
 </div>
 <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group" aria-label="Property category">
 {[{ key: "all", label: "All" }, { key: "residential", label: "Homes" }, { key: "commercial", label: "Commercial" }, { key: "pg", label: "PG / co-living" }, { key: "plot", label: "Plots" }, { key: "land", label: "Land" }, { key: "auction", label: "Bank auctions" }].map(({ key, label }) => (
 <button key={key} type="button" onClick={() => updateMarket(intent, key as MarketCategory)} aria-pressed={category === key} className={`shrink-0 rounded-lg px-3 py-2 stamp font-semibold transition-colors ${category === key ? "border border-brick bg-sand text-ink" : "border border-transparent ink-2 hover:text-brick"}`}>
 {label}
 </button>
 ))}
 </div>
 </div>

 <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
 <div className="field-rule">
 <h1 className="display text-[clamp(36px,5vw,68px)]">{results.length} {marketLabel} {intentLabel} <span className="ink-3">in</span> <em>{activeCity ? `${activeCity.name}.` : t.search.cityName}</em></h1>
 {pincode && (
 /* A PIN filter is stated plainly, with the places it resolved to
 and a way out, so the smaller result count is never a mystery. */
 <p className="stamp mt-4 ink-2">
 PIN {pincode}
 {pincodeMatch?.localities.length
 ? ` · ${pincodeMatch.localities.map((locality) => locality.name).join(", ")}, ${pincodeMatch.city.name}`
 : pincodeMatch
 ? ` · ${pincodeMatch.city.name} (no locality in the demo registry claims this PIN)`
 : " · outside every covered postal district"}
 <button type="button" onClick={() => patch((p) => p.delete("pincode"))} className="ml-3 underline decoration-brick underline-offset-4 hover:text-brick">
 Clear PIN
 </button>
 <span className="ml-3 ink-3">{PINCODE_PROVENANCE}</span>
 </p>
 )}
 </div>
 <div className="flex gap-2">
 {/* One Filters control for every viewport. Below lg it opens the
 sheet; at lg+ the rail is already visible so it scrolls to it. */}
 <button onClick={() => setFilterOpen(true)} className="touch-44 inline-flex items-center gap-2 rounded-lg border border-ink/20 px-4 stamp font-semibold transition-colors hover:border-brick hover:text-brick md:hidden">
 <SlidersHorizontal size={14} /> {t.search.filtersButton}
 {activeCount > 0 && <span className="clay-fill grid h-5 w-5 place-items-center rounded-full bg-brick font-mono text-[11px] font-bold text-cream">{activeCount}</span>}
 </button>
 <button onClick={() => setMapMode(!mapMode)} className="touch-44 inline-flex items-center gap-2 rounded-lg border border-ink/20 px-4 stamp font-semibold transition-colors hover:border-brick hover:text-brick" aria-pressed={mapMode}>
 {mapMode ? <><LayoutList size={14} /> {t.search.list}</> : <><MapIcon size={14} /> {t.search.map}</>}
 </button>
 </div>
 </div>
 </div>
 </section>

 {/* Applied constraints + sort, one row. No "Filter layers: 3" vanity block
 and no "Map state: ON/LIVE" readout — a status for a boolean toggle is
 decoration, and it cost a full section of vertical rhythm. */}
 <section className="container py-6">
 <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
 <AppliedFacetRow
 applied={applied}
 onRemove={removeFacet}
 onClear={clearFilters}
 clearLabel={t.search.clearAll}
 relaxations={relaxations}
 relaxTitle={results.length === 0 ? t.search.facet.relaxTitle : undefined}
 relaxAction={results.length === 0 ? t.search.facet.relaxAction : undefined}
 onApplyRelaxation={applyRelaxation}
 />
 {applied.length === 0 && (
 <p className="stamp text-ink ink-2">{t.search.filter}: {t.search.facet.hint}</p>
 )}
 <div className="flex shrink-0 items-center gap-2">
 <span className="stamp ink-2">{t.search.sort}</span>
 <Select value={sort} onValueChange={updateSort}>
 <SelectTrigger aria-label={t.search.sortHomes} className="h-11 w-[190px] rounded-none border-ink/20 bg-transparent stamp font-semibold">
 <SelectValue placeholder={t.search.sortFresh} />
 </SelectTrigger>
 <SelectContent className="rounded-none border-ink/15 bg-paper">
 <SelectItem value="fresh">{t.search.sortFresh}</SelectItem>
 <SelectItem value="price-asc">{t.search.sortAsc}</SelectItem>
 <SelectItem value="price-desc">{t.search.sortDesc}</SelectItem>
 </SelectContent>
 </Select>
 <button type="button" onClick={() => setFilterOpen(true)} className="touch-44 hidden items-center gap-2 rounded-lg border border-ink/20 px-4 stamp font-semibold transition-colors hover:border-brick hover:text-brick md:inline-flex lg:hidden">
 <SlidersHorizontal size={14} /> {t.search.filtersButton}
 {activeCount > 0 && <span className="clay-fill grid h-5 w-5 place-items-center rounded-full bg-brick font-mono text-[11px] font-bold text-cream">{activeCount}</span>}
 </button>
 </div>
 </div>
 </section>

 {/* Results + filters + map */}
 <section className="container pb-12 md:pb-16">
 <div className={`grid gap-8 ${mapMode ? "" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
 {/* Desktop rail: same panel, same counts, same footer as the sheet. */}
 {!mapMode && (
 <aside className="hidden lg:block">
 <div className="rail-scroll lg:sticky lg:top-[102px] border border-ink/12 bg-card px-4 py-3">
 {panel("rail")}
 </div>
 </aside>
 )}

 <div className={mapMode ? "lg:col-span-2" : ""}>
 <div className="mb-7 flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
 <p className="stamp ink-2" aria-live="polite" role="status">
 {loading ? t.search.updating : `${results.length} ${results.length === 1 ? t.search.home : t.search.homes}${activeCount ? ` · ${activeCount} ${activeCount === 1 ? "filter" : "filters"}` : ""}`}
 </p>
 <p className="stamp hidden text-trust sm:block">{t.search.demoFixtures}</p>
 </div>
 <div className={`grid gap-6 ${mapMode ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-1 xl:grid-cols-2"}`} aria-busy={loading}>
 {loading ? (
 Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
 ) : (
 results.map((property, i) => (
 /* Keyed on the listing alone, and the stagger is capped at 4
 items / 40ms and only on the first paint. v4 keyed on
 filters+sort and staggered 24 cards by 60ms, so clicking a
 filter replayed ~1.4s of choreography over results that were
 already on screen. The animation itself is `.architech-reveal` in theme.css and
 runs on MOUNT only, so surviving cards keep their DOM across a filter change
 and do not re-animate. */
 <Reveal key={property.id} delay={Math.min(i, 3) * 40}>
 <div id={`listing-${property.id}`} onMouseEnter={() => setSelectedId(property.id)} onFocus={() => setSelectedId(property.id)} className={selectedId === property.id ? "ring-2 ring-brick ring-offset-4 ring-offset-paper" : undefined}>
 <PropertyCard property={property} index={i} />
 {!mapMode && (
 <button type="button" onClick={() => { setSelectedId(property.id); setQuickViewOpen(true); }} className="mt-2 min-h-[44px] w-full rounded-lg border border-ink/15 bg-paper px-4 py-2 text-left stamp font-semibold text-brick transition-colors hover:border-brick hover:bg-sand/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick" aria-label={`Quick view ${property.title}`}>
 Quick view · {property.locality} · {property.price}
 </button>
 )}
 </div>
 </Reveal>
 ))
 )}
 </div>

 {/* Zero-result ladder: never a dead end. For a product paid by leads,
 an empty page is a lost lead — so each rung is either a quantified
 fix or a capture, and none of them apologise. */}
 {!loading && results.length === 0 && (
 <div className="relative overflow-hidden border border-dashed border-ink/25 bg-sand/35 p-8 md:p-12">
 <div className="relative grid gap-8 md:grid-cols-[1fr_0.72fr] md:items-end">
 <div>
 <p className="kicker text-brick">Field note / inventory watch</p>
 <p className="mt-5 font-display text-3xl tracking-[-0.02em]">
 {query ? <>{t.search.noHomesYet} “{query}” {activeCount > 0 ? t.search.withFilters : ""} — <em className="text-brick">{t.search.yet}</em>.</> : <>{t.search.noCombination} — <em className="text-brick">{t.search.yet}</em>.</>}
 </p>
 <p className="mt-3 max-w-[480px] text-sm leading-6 ink-2">{t.search.emptyHelp}</p>
 </div>
 <div className="border-l-2 border-brick/60 pl-5 text-sm leading-6 ink-2">
 <p className="stamp text-trust">SOURCE COVERAGE · LIVE</p>
 <p className="mt-2">This locality is being watched for verified inventory. Fresh records appear only after source review and consent checks.</p>
 <p className="mt-4 stamp ink-3">NEXT STEP · loosen one filter, broaden the brief, or save the search</p>
 </div>
 </div>

 {/* Rung 1 — quantified relaxations, rendered above the chips. */}
 {relaxations.length > 0 && (
 <div className="relative mt-8 flex flex-wrap items-center gap-2 border-t border-ink/12 pt-6">
 <span className="stamp text-brick">{t.search.facet.relaxTitle}</span>
 {relaxations.map((relaxation) => (
 <button key={relaxation.groupId} type="button" onClick={() => applyRelaxation(relaxation.groupId)} className="touch-44 min-h-[44px] rounded-lg border border-brick/50 px-4 stamp font-semibold text-brick transition-colors hover:bg-sand">
 {t.search.facet.relaxAction(relaxation.groupLabel, relaxation.gain)}
 </button>
 ))}
 </div>
 )}

 {/* Rung 2 — widen to a locality that actually has inventory. */}
 {widening.length > 0 && (
 <div className="relative mt-5 flex flex-wrap items-center gap-2">
 <span className="stamp text-brick">{t.search.facet.widenTitle}</span>
 {widening.map((value) => (
 <button key={value.id} type="button" onClick={() => applyWidening(value.id)} className="touch-44 min-h-[44px] rounded-lg border border-ink/20 px-4 stamp font-semibold text-ink transition-colors hover:border-brick hover:text-brick">
 {t.search.facet.widenAction(value.label, value.count ?? 0)}
 </button>
 ))}
 </div>
 )}

 <div className="relative mt-8 flex flex-wrap gap-2 border-t border-ink/12 pt-6">
 {trending.map((suggestion) => (
 <button key={suggestion.query} onClick={() => runQuery(suggestion.query)} title={suggestion.hint} className="touch-44 rounded-lg border border-ink/20 px-4 stamp font-semibold ink-2 transition-colors hover:border-brick hover:text-brick">
 Try {suggestion.label}
 </button>
 ))}
 </div>

 {/* Rung 3 — capture, with the filters carried across. */}
 <div className="relative mt-7 rounded-lg border border-ink/12 bg-card p-5">
 <p className="font-display text-xl font-medium leading-tight">{t.search.facet.captureTitle}</p>
 <p className="mt-2 max-w-[520px] text-sm leading-6 ink-2">{t.search.facet.captureBody}</p>
 <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
 <Link href={briefHref} className="clay-fill btn-solid touch-44 inline-flex items-center justify-center gap-1.5 bg-brick px-6 py-3 stamp font-semibold text-cream">
 {t.search.facet.captureCta} <ArrowUpRight size={13} />
 </Link>
 <button type="button" onClick={() => void saveSearch()} disabled={savingSearch} className="touch-44 inline-flex items-center gap-1.5 rounded-lg border border-ink/20 px-4 py-3 stamp font-semibold text-ink transition-colors hover:border-brick hover:text-brick disabled:cursor-wait">
 {savingSearch ? "…" : t.search.saveSearch}
 </button>
 <Link href="/guide" className="touch-44 inline-flex items-center gap-1.5 px-4 py-3 stamp font-semibold text-brick">{t.search.readGuides} <ArrowUpRight size={13} /></Link>
 {briefCarries && <span className="stamp text-trust">your filters come with it</span>}
 </div>
 </div>
 </div>
 )}
 {!loading && results.length > 0 && (
 <div className="mt-12 flex items-center justify-between border-t border-ink/10 pt-6">
 <span className="stamp ink-2">{t.search.showingAll} {results.length} {t.search.demoInventorySuffix}</span>
 </div>
 )}
 </div>
 </div>

 {/* Map: `mapMode` at lg+ now expands the map to the full content width
 and collapses the list, instead of the v4 behaviour where the toggle
 was `lg:hidden` and therefore did nothing on desktop. */}
 {mapMode && (
 <div className="mt-8">
 <MapListSync
 listings={results}
 selectedId={selectedId}
 onSelect={setSelectedId}
 className="vh-cta border border-ink/12"
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
 )}
 {!mapMode && (
 <div className="mt-8 lg:hidden">
 <MapListSync
 listings={results}
 selectedId={selectedId}
 onSelect={setSelectedId}
 className="h-[52vh]"
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
 )}
 </section>

 {/* Filter sheet (below lg). The rail above lg renders the same panel. */}
 <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
 <DrawerContent className="border-t-2 border-brick bg-paper">
 <DrawerHeader className="text-left">
 <DrawerTitle className="font-display text-2xl font-medium tracking-[-0.02em]">{t.search.filterHomes}</DrawerTitle>
 </DrawerHeader>
 <div className="px-4 pb-2">{panel("sheet")}</div>
 <div className="safe-bottom sticky bottom-0 border-t border-ink/12 bg-paper px-4 py-3">
 <DrawerClose asChild>
 <button className="clay-fill touch-44 w-full bg-brick py-3.5 stamp font-semibold text-cream">
 {results.length === 1 ? t.search.facet.showOneHome : t.search.facet.showHomes} · {results.length}
 </button>
 </DrawerClose>
 </div>
 </DrawerContent>
 </Drawer>

 <Drawer open={quickViewOpen} onOpenChange={setQuickViewOpen}>
 <DrawerContent className="border-t-2 border-brick bg-paper text-ink sm:max-w-[520px] sm:ml-auto sm:rounded-none">
 {selectedProperty && (
 <div className="p-5 sm:p-7">
 <div className="flex items-start justify-between gap-4">
 <div>
 <p className="kicker text-brick">Quick view · Ahmedabad</p>
 <h2 className="mt-2 font-display text-2xl font-medium leading-tight tracking-[-0.02em]">{selectedProperty.title}<span className="text-brick">.</span></h2>
 </div>
 <button type="button" onClick={() => setQuickViewOpen(false)} className="touch-44 rounded-lg border border-ink/15 px-3 stamp font-semibold ink-2 hover:border-brick hover:text-brick">Close</button>
 </div>
 <div className="mt-5 overflow-hidden border border-ink/12 bg-sand">
 <Pic name={selectedProperty.image} alt={`${selectedProperty.title}, ${selectedProperty.locality}`} className="aspect-[1.6] h-full w-full object-cover" sizes="520px" />
 </div>
 <div className="mt-5 grid grid-cols-2 gap-4 border-y border-ink/12 py-4 sm:grid-cols-4">
 <div><p className="stamp ink-3">Price</p><p className="mt-1 font-display text-lg font-semibold [font-variant-numeric:tabular-nums]">{selectedProperty.price}</p></div>
 <div><p className="stamp ink-3">Layout</p><p className="mt-1 text-sm font-semibold">{selectedProperty.meta}</p></div>
 <div><p className="stamp ink-3">Area</p><p className="mt-1 text-sm font-semibold [font-variant-numeric:tabular-nums]">{selectedProperty.area}</p></div>
 <div><p className="stamp ink-3">Status</p><p className="mt-1 text-sm font-semibold text-trust">{selectedProperty.status}</p></div>
 </div>
 <div className="mt-5 grid grid-cols-2 gap-px border border-ink/10 bg-ink/10 sm:grid-cols-3">
 {propertyFactRows(selectedProperty.details).map(([label, value]) => <div key={label} className="bg-paper p-3"><p className="stamp ink-3">{label}</p><p className="mt-1 text-sm font-semibold text-ink">{value}</p></div>)}
 </div>
 <p className="mt-5 text-sm leading-7 ink-2">{selectedProperty.note}</p>
 <p className="mt-4 border-l-2 border-brick/50 pl-3 text-xs leading-5 ink-2"><span className="font-semibold text-ink">Amenities.</span> {selectedProperty.details.amenities?.join(" · ") || "Not specified"} · {labelForFurnishing(selectedProperty.details.furnishing)} · {labelForFacing(selectedProperty.details.facing)}</p>
 <div className="mt-6 flex flex-col gap-3 sm:flex-row">
 <Link href={`/listing/${selectedProperty.id}`} onClick={() => setQuickViewOpen(false)} className="night-fill btn-sweep touch-44 inline-flex flex-1 items-center justify-center bg-night px-5 py-3 stamp font-semibold text-cream">Full details <ArrowUpRight size={13} className="ml-1" /></Link>
 <Link href={`/requirements/?listing=${encodeURIComponent(selectedProperty.id)}`} onClick={() => setQuickViewOpen(false)} className="touch-44 inline-flex flex-1 items-center justify-center rounded-lg border border-ink/20 px-5 py-3 stamp font-semibold text-brick hover:border-brick">Schedule a visit</Link>
 </div>
 </div>
 )}
 </DrawerContent>
 </Drawer>
 </div>
 );
}

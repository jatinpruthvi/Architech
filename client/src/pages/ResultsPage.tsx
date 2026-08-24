/* ARCHITECH — Search results v3.
   A11y: aria-live result announcements, aria-busy skeletons, 44px touch targets, keyboard-safe filters.
   Mobile: bottom-sheet filter drawer, map toggle. Discovery: curated empty state, search-this-area affordance. */
import { ArrowUpRight, Crosshair, LayoutList, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import PropertyCard, { properties } from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";

type Filter = { id: string; label: string; fn: (p: (typeof properties)[number]) => boolean };

const filters: Filter[] = [
  { id: "all", label: "All homes", fn: () => true },
  { id: "2bhk", label: "2 BHK", fn: (p) => p.bhk === 2 },
  { id: "3bhk", label: "3 BHK +", fn: (p) => p.bhk >= 3 },
  { id: "under15", label: "Under ₹1.5 Cr", fn: (p) => p.price.includes("L") || parseFloat(p.price.replace(/[₹ Cr]/g, "")) < 1.5 },
  { id: "rera", label: "RERA verified", fn: (p) => p.badge === "RERA verified" },
];

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

function FilterChips({ active, onSelect, vertical = false }: { active: string; onSelect: (id: string) => void; vertical?: boolean }) {
  return (
    <div className={vertical ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"} role="group" aria-label="Filters">
      {filters.map((f) => (
        <button key={f.id} onClick={() => onSelect(f.id)} aria-pressed={active === f.id}
          className={`touch-44 px-4 stamp !text-[11px] font-semibold transition-all duration-200 ${vertical ? "w-full text-left py-3.5" : "py-2.5"} ${active === f.id ? "bg-brick text-paper" : "border border-ink/20 text-ink/70 hover:border-brick hover:text-brick"}`}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

export default function ResultsPage() {
  const [active, setActive] = useState("all");
  const [mapMode, setMapMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const filtered = useMemo(() => properties.filter(filters.find((f) => f.id === active)!.fn), [active]);
  const activeLabel = filters.find((f) => f.id === active)!.label;

  const selectFilter = (id: string) => {
    setActive(id);
    setDrawerOpen(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoading(false), 450);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="bg-paper pt-[78px] text-ink">
      {/* Header */}
      <section className="border-b border-ink/12 bg-sand/70 py-12 md:py-16">
        <div className="container">
          <p className="kicker text-brick">Search · Ahmedabad</p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <h1 className="display text-[clamp(36px,5vw,68px)]">{filtered.length === properties.length ? "281 homes" : `${filtered.length} of 281 homes`} in <em className="text-brick">Ahmedabad.</em></h1>
            <div className="flex gap-2">
              {/* Mobile: bottom-sheet filters */}
              <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerTrigger asChild>
                  <button className="touch-44 inline-flex items-center gap-2 border border-ink/20 px-4 stamp !text-[11px] font-semibold transition-colors hover:border-brick hover:text-brick md:hidden">
                    <SlidersHorizontal size={14} /> Filters {active !== "all" && <span className="grid h-5 w-5 place-items-center rounded-full bg-brick text-[10px] text-paper">1</span>}
                  </button>
                </DrawerTrigger>
                <DrawerContent className="border-t-2 border-brick bg-paper">
                  <DrawerHeader className="text-left">
                    <DrawerTitle className="font-display text-2xl font-medium tracking-[-0.02em]">Filter homes</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-8">
                    <FilterChips active={active} onSelect={selectFilter} vertical />
                    <DrawerClose asChild>
                      <button className="touch-44 mt-5 w-full bg-ink py-3.5 stamp !text-[12px] font-semibold text-paper">Show {filtered.length} homes</button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <button onClick={() => setMapMode(!mapMode)} className="touch-44 inline-flex items-center gap-2 border border-ink/20 px-4 stamp !text-[11px] font-semibold transition-colors hover:border-brick hover:text-brick lg:hidden" aria-pressed={mapMode}>
                {mapMode ? <><LayoutList size={14} /> List</> : <><MapIcon size={14} /> Map</>}
              </button>
            </div>
          </div>
          {/* Desktop filter chips */}
          <div className="mt-8 hidden items-center gap-2 md:flex">
            <span className="mr-2 flex items-center gap-1.5 stamp !text-[10px] text-ink/45"><SlidersHorizontal size={12} /> Filter</span>
            <FilterChips active={active} onSelect={selectFilter} />
          </div>
        </div>
      </section>

      {/* Results + map */}
      <section className="container py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className={mapMode ? "hidden lg:block" : ""}>
            <div className="mb-7 flex items-center justify-between border-b border-ink/10 pb-4">
              {/* ARIA live region announces result changes to screen readers */}
              <p className="stamp !text-[11px] text-ink/50" aria-live="polite" role="status">
                {loading ? "Updating results…" : `Showing ${filtered.length} homes · ${activeLabel} · sorted by freshness`}
              </p>
              <p className="stamp hidden !text-[11px] text-trust sm:block">Updated throughout the day</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2" aria-busy={loading}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : filtered.map((property, i) => (
                    <Reveal key={`${active}-${property.id}`} delay={i * 60}><PropertyCard property={property} index={i} /></Reveal>
                  ))}
            </div>
            {/* Curated empty state */}
            {!loading && filtered.length === 0 && (
              <div className="border border-dashed border-ink/25 p-10 text-center md:p-14">
                <p className="font-display text-3xl tracking-[-0.02em]">Nothing here — <em className="text-brick">yet</em>.</p>
                <p className="mx-auto mt-3 max-w-[380px] text-sm leading-6 text-ink/55">No homes match that combination today. Try one of these instead — or save this search and we'll tell you the moment something arrives.</p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {trending.map((t) => (
                    <button key={t} onClick={() => selectFilter("all")} className="touch-44 border border-ink/20 px-4 stamp !text-[11px] font-semibold text-ink/70 transition-colors hover:border-brick hover:text-brick">{t}</button>
                  ))}
                </div>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button onClick={() => toast("Search saved", { description: "We'll notify you when a matching home arrives." })} className="touch-44 bg-brick px-6 stamp !text-[11px] font-semibold text-paper">Save this search</button>
                  <Link href="/guide" className="touch-44 inline-flex items-center gap-1.5 px-4 py-3 stamp !text-[11px] font-semibold text-brick">Read locality guides <ArrowUpRight size={13} /></Link>
                </div>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <div className="mt-12 flex items-center justify-between border-t border-ink/10 pt-6">
                <span className="stamp !text-[11px] text-ink/50">Page 1 of 43</span>
                <button className="touch-44 group inline-flex items-center gap-2 px-2 stamp !text-[12px] font-semibold text-brick">Next page <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></button>
              </div>
            )}
          </div>

          {/* Real OpenStreetMap aside */}
          <aside className={`relative min-h-[480px] overflow-hidden border border-ink/12 bg-sand ${mapMode ? "block" : "hidden lg:block"} lg:sticky lg:top-[102px] lg:h-[calc(100vh-130px)]`} aria-label="Map of Ahmedabad homes">
            <iframe
              title="Map of Ahmedabad localities — OpenStreetMap"
              src="https://www.openstreetmap.org/export/embed.html?bbox=72.4300%2C22.9650%2C72.6350%2C23.0950&layer=mapnik&marker=23.011%2C72.559"
              className="map-frame absolute inset-0 h-full w-full border-0"
              loading="lazy"
            />
            <p className="stamp absolute right-3 top-3 z-10 bg-paper/90 px-2 py-1 !text-[9px] text-ink/60">© OpenStreetMap contributors</p>
            {/* Search-this-area affordance */}
            <button
              onClick={() => { selectFilter("all"); toast("Searching this area", { description: "Results updated for the visible map area." }); }}
              className="touch-44 absolute left-1/2 top-4 z-10 inline-flex -translate-x-1/2 items-center gap-2 bg-ink px-5 stamp !text-[11px] font-semibold text-paper shadow-lg transition-transform hover:-translate-y-0.5">
              <Crosshair size={14} className="text-ember" /> Search this area
            </button>
            <div className="pointer-events-none absolute inset-x-5 bottom-5 z-10 border border-ink/12 bg-paper/95 p-5 backdrop-blur">
              <p className="stamp !text-[10px] font-semibold text-brick">Live cartography · Paldi pinned</p>
              <p className="mt-2 text-sm leading-6 text-ink/65">Real OpenStreetMap data for Ahmedabad — explore the shape of the neighbourhood without losing the list.</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

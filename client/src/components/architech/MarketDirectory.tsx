"use client";
/* India-wide marketplace directory: category-led discovery without third-party claims. */
import Link from "next/link";
import { ArrowUpRight, Banknote, Building2, Home, MapPinned, Newspaper, Sprout } from "lucide-react";
import RequirementCapture from "@/components/architech/RequirementCapture";

const categories = [
  { key: "residential", label: "Homes", icon: Home },
  { key: "commercial", label: "Commercial", icon: Building2 },
  { key: "pg", label: "PG / co-living", icon: Sprout },
  { key: "plot", label: "Plots", icon: MapPinned },
  { key: "land", label: "Land", icon: MapPinned },
  { key: "auction", label: "Bank auctions", icon: Banknote },
] as const;

const developers = [
  ["India builder index", "City-scoped evidence"],
  ["Verified partner directory", "Review status in view"],
  ["Project document register", "Applicable RERA context"],
] as const;

export type MarketProject = {
  name: string;
  developer: string;
  locality: string;
  href: string;
  label: string;
};

export type MarketLocalityLink = {
  slug: string;
  name: string;
  citySlug: string;
  cityName: string;
};

export default function MarketDirectory({
  projects,
  localityLinks,
}: {
  projects: MarketProject[];
  localityLinks: MarketLocalityLink[];
}) {
  return (
    <section className="border-y border-ink/12 bg-sand/60 py-20 md:py-28" aria-labelledby="market-directory-title">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="kicker text-brick">Indian city markets, arranged</p>
            <h2 id="market-directory-title" className="display mt-4 max-w-[760px] text-[clamp(34px,5vw,68px)]">Find a place by <em className="text-brick">what it is.</em></h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-ink/65">The category, locality, project, and source trail stay visible together. Start broad, then follow the address until it makes sense.</p>
          </div>
          <Link href="/buy/" className="link-rail stamp self-start !text-[11px] font-semibold text-brick md:self-end">Explore all cities and localities <ArrowUpRight size={14} className="ml-1 inline" /></Link>
        </div>

        <nav className="mt-12 grid grid-cols-2 border-y border-ink/15 sm:grid-cols-3 lg:grid-cols-6" aria-label="Property categories">
          {categories.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={`/search/?category=${key}`} className="group flex min-h-28 flex-col justify-between border-b border-r border-ink/15 p-4 transition-colors hover:bg-paper hover:text-brick sm:min-h-32 lg:border-b-0">
              <Icon size={18} strokeWidth={1.6} className="text-brick transition-transform duration-300 group-hover:-translate-y-1" />
              <span className="font-display text-xl font-medium tracking-[-0.02em]">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-16 grid gap-12 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <div className="flex items-end justify-between border-b border-ink/15 pb-4"><div><p className="kicker text-brick">Featured project rail</p><h3 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em]">Projects worth a second look.</h3></div><span className="stamp !text-[12px] text-ink/55">curated · demo inventory</span></div>
            <div className="grid gap-4 pt-5 md:grid-cols-3">
              {projects.map((project, index) => (
                <Link key={project.name} href={project.href} className="group border border-ink/15 bg-paper p-5 transition-transform duration-300 hover:-translate-y-1 hover:border-brick">
                  <p className="stamp !text-[12px] text-brick">Nº {String(index + 1).padStart(2, "0")} · {project.label}</p>
                  <h4 className="mt-14 font-display text-2xl font-medium leading-tight tracking-[-0.03em] group-hover:text-brick">{project.name}</h4>
                  <p className="mt-3 text-sm text-ink/60">{project.developer}</p>
                  <p className="stamp mt-6 !text-[12px] text-ink/55">{project.locality} · source trail on page <ArrowUpRight size={12} className="ml-1 inline" /></p>
                </Link>
              ))}
            </div>
          </div>
          <aside className="border-l border-ink/15 pl-6 lg:pl-8">
            <p className="kicker text-brick">Developer index</p>
            <h3 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em]">Build with context.</h3>
            <div className="mt-6 divide-y divide-ink/15 border-y border-ink/15">
              {developers.map(([name, detail]) => <Link key={name} href="/developers/" className="group flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-brick"><span><strong className="block font-medium">{name}</strong><span className="stamp mt-1 block !text-[12px] text-ink/50">{detail}</span></span><ArrowUpRight size={14} className="shrink-0 text-brick transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>)}
            </div>
            <Link href="/developers/" className="link-rail mt-5 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-brick">Browse the developer index <ArrowUpRight size={13} /></Link>
          </aside>
        </div>

        <div className="mt-16 grid gap-8 border-t border-ink/15 pt-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <div><p className="kicker text-brick">Locality search index</p><div className="mt-4 flex max-w-3xl flex-wrap gap-x-5 gap-y-3">{localityLinks.map((locality) => <Link key={`${locality.citySlug}:${locality.slug}`} href={`/search/?city=${locality.citySlug}&q=${encodeURIComponent(locality.name)}`} className="link-rail font-display text-xl tracking-[-0.02em] text-ink/75 hover:text-brick">{locality.name} <span className="text-sm ink-3">· {locality.cityName}</span></Link>)}</div></div>
          <div className="flex flex-col items-start gap-3 lg:items-end"><Link href="/investment/" className="inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-brick"><Newspaper size={14} /> India investment lens <ArrowUpRight size={13} /></Link><Link href="/guide/" className="inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-ink/65 hover:text-brick">Buying guides and field notes <ArrowUpRight size={13} /></Link></div>
        </div>

        <div className="mt-12 flex flex-col gap-5 border border-brick/30 bg-paper p-6 md:flex-row md:items-center md:justify-between md:p-8"><div><p className="kicker text-brick">Personal property brief</p><p className="mt-2 max-w-xl font-display text-2xl tracking-[-0.02em]">Tell us the locality, category, and life you are trying to fit.</p></div><RequirementCapture /></div>
      </div>
    </section>
  );
}

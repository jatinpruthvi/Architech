import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { Scale } from "lucide-react";
import { getListings } from "@/lib/repositories";
import { mediaDisplayUrl } from "@/lib/media/display-url";
import { COMPARE_ROWS, selectComparableListings } from "@/lib/compare";

export const metadata: Metadata = {
  title: "Compare homes across India | Architech",
  description: "Compare selected properties by price, area, availability, verification, and source evidence.",
  robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const params = await searchParams;
  const homes = selectComparableListings(getListings(), params.ids);

  return (
    <main className="vh-fill bg-paper pt-[110px] text-ink">
      <div className="container pb-24">
        <Link href="/search/" className="stamp !text-[11px] font-semibold text-brick underline underline-offset-4">← Back to search</Link>
        <div className="mt-8 flex items-end justify-between gap-6 border-b border-ink/15 pb-8">
          <div><p className="kicker text-brick">Shared shortlist</p><h1 className="display mt-3 text-[clamp(38px,6vw,76px)]">Decision dossier<span className="text-brick">.</span></h1><p className="mt-4 max-w-xl text-sm leading-7 text-ink/60">A source-aware comparison of {homes.length} selected {homes.length === 1 ? "home" : "homes"}. Prices and availability remain subject to the latest verified listing record.</p></div>
          <Scale className="hidden text-brick md:block" size={42} strokeWidth={1} aria-hidden="true" />
        </div>
        {homes.length < 2 ? (
          <div className="mt-10 border border-dashed border-ink/25 bg-sand/45 p-8"><p className="font-display text-2xl">Add at least two homes to compare.</p><p className="mt-3 text-sm leading-6 text-ink/60">Return to search and use the compare control on the property cards.</p></div>
        ) : (
          <div className="mt-10 overflow-x-auto border border-ink/12 bg-card">
            <div className="grid min-w-[720px] gap-x-5" style={{ gridTemplateColumns: `140px repeat(${homes.length}, minmax(150px, 1fr))` }}>
              <div className="bg-night p-4 stamp !text-[10px] text-cream/65">Compare</div>
              {homes.map((property) => <Link key={property.id} href={`/listing/${property.id}`} className="night-fill group bg-night p-4 text-cream"><span className="block aspect-[1.6] overflow-hidden"><img src={mediaDisplayUrl(property.imageUrl, 640) ?? `/images/${property.image}.jpg`} alt={property.title} className="h-full w-full object-cover" width="260" height="160" /></span><span className="mt-3 block font-display text-base leading-tight group-hover:text-ember">{property.title}</span></Link>)}
              {COMPARE_ROWS.map(({ label, get }) => <div key={label} className="contents"><div className="border-t border-ink/10 bg-sand/45 px-4 py-4 stamp !text-[10px] text-ink/60">{label}</div>{homes.map((property) => <div key={`${label}-${property.id}`} className={`border-t border-ink/10 px-4 py-4 text-sm ${label === "Price" ? "font-display text-lg font-semibold" : "text-ink/80"}`}>{get(property)}</div>)}</div>)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

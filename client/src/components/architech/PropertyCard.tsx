/* Architech Editorial Terracotta: Ahmedabad property cards with evidence-led hierarchy, stable view-model data, and restrained motion. */
import { ArrowUpRight, BedDouble, Heart, MapPin, Ruler, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export type Property = { id: string; title: string; locality: string; city: string; price: string; meta: string; area: string; image: string; badge?: string; status?: string };

const atlasNotes: Record<string, string> = {
  Paldi: "Tree-lined residential streets, Law Garden access, and source trail reviewed.",
  "Prahlad Nagar": "Everyday retail, newer buildings, and partner source trail reviewed.",
  Thaltej: "Western-edge quiet, larger homes, and latest partner update reviewed.",
};

export const properties: Property[] = [
  { id: "garden-courtyard", title: "A garden courtyard in Paldi", locality: "Paldi", city: "Ahmedabad", price: "₹1.85 Cr", meta: "3 BHK · Ready to move", area: "1,482 sq ft", image: "/manus-storage/architech-ahmedabad-interior_d69d08e0.jpg", badge: "RERA verified", status: "Updated 2 days ago" },
  { id: "light-filled-home", title: "Light across every room", locality: "Prahlad Nagar", city: "Ahmedabad", price: "₹1.24 Cr", meta: "2 BHK · New launch", area: "1,092 sq ft", image: "/manus-storage/architech-ahmedabad-locality_fadc78b5.jpg", badge: "Verified partner", status: "Updated today" },
  { id: "thalej-courtyard", title: "A quieter edge of Thaltej", locality: "Thaltej", city: "Ahmedabad", price: "₹1.56 Cr", meta: "2 BHK · Resale", area: "1,126 sq ft", image: "/manus-storage/architech-ahmedabad-detail_9e4baf39.jpg", badge: "RERA verified", status: "Updated 4 days ago" },
];

export default function PropertyCard({ property, compact = false }: { property: Property; compact?: boolean }) {
  return <article className={`group relative overflow-hidden border border-ink/10 bg-paper surface-lift ${compact ? "grid grid-cols-[112px_1fr] gap-4 p-3" : ""}`}>
    <Link href={`/listing/${property.id}`} className="block" aria-label={`View ${property.title}`}>
      <div className={`relative overflow-hidden bg-limestone ${compact ? "h-full min-h-[112px]" : "aspect-[1.18]"}`}><img src={property.image} alt={`${property.title}, ${property.locality}, Ahmedabad`} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]" /><div className="absolute inset-x-0 top-0 flex items-start justify-between p-4"><span className="bg-paper/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-ink">{property.badge}</span><button onClick={(event) => event.preventDefault()} className="grid h-8 w-8 place-items-center rounded-full bg-paper/90 text-ink transition-colors hover:bg-clay hover:text-paper" aria-label="Save property"><Heart size={15} strokeWidth={1.8} /></button></div></div>
    </Link>
    <div className={compact ? "py-1 pr-2" : "p-5"}><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-clay"><ShieldCheck size={13} /> {property.status}</div><Link href={`/listing/${property.id}`}><h3 className={`font-display font-semibold leading-[1.08] tracking-[-.025em] text-ink transition-colors group-hover:text-clay ${compact ? "text-xl" : "text-[26px]"}`}>{property.title}</h3></Link><p className="mt-2 flex items-center gap-1.5 text-sm text-ink/60"><MapPin size={14} className="text-clay" /> {property.locality}, {property.city}</p>{!compact && <p className="mt-3 border-l-2 border-[var(--clay)] pl-3 text-xs leading-5 text-ink/55">Atlas note · {atlasNotes[property.locality] ?? `${property.locality} context and source trail reviewed.`}</p>}<div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink/65"><span className="flex items-center gap-1.5"><BedDouble size={14} /> {property.meta}</span><span className="flex items-center gap-1.5"><Ruler size={14} /> {property.area}</span></div><div className="mt-5 flex items-end justify-between border-t border-ink/10 pt-4"><strong className="font-display text-xl text-ink">{property.price}</strong><Link href={`/listing/${property.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-clay">View home <ArrowUpRight size={14} /></Link></div></div>
  </article>;
}

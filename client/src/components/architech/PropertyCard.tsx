/* ARCHITECH — Property card v3.
   Visual weight hierarchy: price + location (primary) → property details (secondary) → RERA/source badge (tertiary, tooltip).
   Micro-interactions: save with toast feedback, compare on hover, 44px touch targets, progressive disclosure on mobile. */
import { ArrowUpRight, BedDouble, Heart, MapPin, Ruler, Scale, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Property = {
  id: string; title: string; locality: string; city: string; price: string; pricePerSqft: string;
  meta: string; bhk: number; area: string; areaNum: number; image: string; badge: string; status: string; note: string;
};

export const properties: Property[] = [
  { id: "garden-courtyard", title: "A garden courtyard in Paldi", locality: "Paldi", city: "Ahmedabad", price: "₹1.85 Cr", pricePerSqft: "₹12,480 / sq ft", meta: "3 BHK · Ready to move", bhk: 3, area: "1,482 sq ft", areaNum: 1482, image: "/images/prop-courtyard.jpg", badge: "RERA verified", status: "Updated 2 days ago", note: "Old trees, kota stone floors, and a courtyard that carries the whole house." },
  { id: "light-filled-home", title: "Light across every room", locality: "Prahlad Nagar", city: "Ahmedabad", price: "₹1.24 Cr", pricePerSqft: "₹11,350 / sq ft", meta: "2 BHK · New launch", bhk: 2, area: "1,092 sq ft", areaNum: 1092, image: "/images/prop-light.jpg", badge: "Verified partner", status: "Updated today", note: "Morning sun through sheer curtains; a single brick wall keeps it grounded." },
  { id: "thaltej-dusk-house", title: "A quieter edge of Thaltej", locality: "Thaltej", city: "Ahmedabad", price: "₹2.40 Cr", pricePerSqft: "₹10,860 / sq ft", meta: "4 BHK · Resale", bhk: 4, area: "2,210 sq ft", areaNum: 2210, image: "/images/prop-thaltej.jpg", badge: "RERA verified", status: "Updated 4 days ago", note: "Brick and white plaster volumes glowing at blue hour, west of the city's rush." },
  { id: "neem-lane-rowhouse", title: "Under the neem canopy", locality: "Navrangpura", city: "Ahmedabad", price: "₹98 L", pricePerSqft: "₹10,420 / sq ft", meta: "2 BHK · Resale", bhk: 2, area: "940 sq ft", areaNum: 940, image: "/images/locality-street.jpg", badge: "Source reviewed", status: "Updated 1 day ago", note: "A tree-lined lane where the street itself is the amenity." },
];

function BadgeTooltip({ property }: { property: Property }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="flex cursor-help items-center gap-1.5 bg-paper/95 px-2.5 py-1.5 stamp !text-[10px] font-semibold text-ink" aria-label={`${property.badge} — details`}>
          <ShieldCheck size={12} className="text-trust" /> {property.badge}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px] border border-ink/15 bg-ink text-paper">
        <p className="stamp !text-[10px] text-ember">GJ/RERA/AHM/2026/0{property.bhk}482</p>
        <p className="mt-1.5 text-xs leading-5">Checked against the Gujarat RERA registry. Last verified 19 Aug 2026 · re-checked on every meaningful update.</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function PropertyCard({ property, arch = false, index }: { property: Property; arch?: boolean; index?: number }) {
  const [saved, setSaved] = useState(false);

  const onSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const next = !saved;
    setSaved(next);
    toast(next ? "Saved to your shortlist" : "Removed from shortlist", {
      description: next ? `${property.title} · ${property.price}` : undefined,
    });
  };

  const onCompare = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    toast("Added to compare", { description: `${property.title} — pick one more home to compare.` });
  };

  return (
    <article className="group relative border border-ink/12 bg-card motion-lift hover:editorial-shadow">
      <Link href={`/listing/${property.id}`} className="block" aria-label={`View ${property.title}, ${property.price}, ${property.locality}`}>
        <div className={`img-hover relative bg-sand ${arch ? "arch-frame-sm" : ""}`}>
          <div className="aspect-[1.25]">
            <img src={property.image} alt={`${property.title}, ${property.locality}, Ahmedabad`} className="h-full w-full object-cover" loading="lazy" />
          </div>
          {/* Tertiary: verification badge with tooltip */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3.5">
            <BadgeTooltip property={property} />
            <div className="flex gap-2">
              <button
                onClick={onCompare}
                className="touch-44 hidden place-items-center rounded-full bg-paper/95 text-ink opacity-0 transition-all duration-200 hover:bg-ink hover:text-paper group-hover:opacity-100 focus-visible:opacity-100 md:grid"
                aria-label={`Compare ${property.title}`}>
                <Scale size={15} strokeWidth={1.8} />
              </button>
              <button
                onClick={onSave}
                className={`touch-44 grid place-items-center rounded-full transition-all duration-200 ${saved ? "scale-110 bg-brick text-paper" : "bg-paper/95 text-ink hover:bg-brick hover:text-paper"}`}
                aria-label={saved ? `Remove ${property.title} from saved` : `Save ${property.title}`} aria-pressed={saved}>
                <Heart size={16} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          {typeof index === "number" && <span className="stamp absolute bottom-3 left-4 z-10 bg-ink/80 px-2 py-1 !text-[10px] text-paper/90">Nº {String(index + 1).padStart(2, "0")}</span>}
        </div>
      </Link>
      <div className="p-5 md:p-6">
        {/* PRIMARY: price + location, boldest elements on the card */}
        <div className="flex items-start justify-between gap-3">
          <strong className="font-display text-[26px] font-semibold leading-none tracking-[-0.025em] text-ink">{property.price}</strong>
          <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-ink/80"><MapPin size={13} className="text-brick" /> {property.locality}</span>
        </div>
        <p className="stamp mt-1 !text-[10px] text-ink/40">{property.pricePerSqft}</p>

        {/* SECONDARY: title + property details */}
        <Link href={`/listing/${property.id}`}>
          <h3 className="mt-3 font-display text-[19px] font-medium leading-[1.15] tracking-[-0.015em] text-ink/85 transition-colors group-hover:text-brick">{property.title}</h3>
        </Link>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 stamp !text-[11px] text-ink/55">
          <span className="flex items-center gap-1.5"><BedDouble size={13} /> {property.meta}</span>
          <span className="flex items-center gap-1.5"><Ruler size={13} /> {property.area}</span>
        </div>
        {/* Progressive disclosure: editorial note only from sm-width up */}
        <p className="mt-3 hidden border-l-2 border-brick/50 pl-3 text-xs leading-5 text-ink/50 sm:block">{property.note}</p>

        {/* TERTIARY: freshness + action */}
        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3.5">
          <span className="stamp !text-[10px] text-trust">{property.status}</span>
          <Link href={`/listing/${property.id}`} className="inline-flex min-h-[44px] items-center gap-1 stamp !text-[11px] font-semibold text-brick">View <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
        </div>
      </div>
    </article>
  );
}

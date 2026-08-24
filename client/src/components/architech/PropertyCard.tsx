"use client";
/* ARCHITECH — Property card v4: shared persistent saves, responsive WebP images,
   price-first hierarchy, honest demo labels, 44px touch targets. */
import { ArrowUpRight, BedDouble, Heart, MapPin, Ruler, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { properties, type Property } from "@/lib/properties";
import { useSaved } from "@/contexts/SavedContext";
import { useCompare } from "@/contexts/CompareContext";
import Pic from "./Pic";



export { properties, type Property };

function BadgeTooltip({ property }: { property: Property }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="flex cursor-help items-center gap-1.5 bg-paper/95 px-2.5 py-1.5 stamp !text-[10px] font-semibold text-ink" aria-label={`${property.badge} — details`}>
          <ShieldCheck size={12} className="text-trust" /> {property.badge}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[250px] border border-ink/15 bg-night text-cream">
        <p className="stamp !text-[10px] text-ember">GJ/RERA/AHM/2026/0{property.bhk}482 (sample)</p>
        <p className="mt-1.5 text-xs leading-5">In production every listing is checked against the Gujarat RERA registry and re-verified on each update. This is an illustrative trail for the concept preview.</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function PropertyCard({ property, arch = false, index }: { property: Property; arch?: boolean; index?: number }) {
  const { isSaved, toggle } = useSaved();
  const { isCompared, toggle: toggleCompare } = useCompare();
  const saved = isSaved(property.id);
  const compared = isCompared(property.id);

  const onSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const nowSaved = toggle(property.id);
    toast(nowSaved ? "Saved to your shortlist" : "Removed from shortlist", {
      description: nowSaved ? `${property.title} · ${property.price}` : undefined,
    });
  };

  const onCompare = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    toggleCompare(property.id);
  };

  return (
    <article className="group relative border border-ink/12 bg-card motion-lift hover:editorial-shadow">
      <Link href={`/listing/${property.id}`} className="block" aria-label={`View ${property.title}, ${property.price}, ${property.locality}`}>
        <div className={`img-hover relative bg-sand ${arch ? "arch-frame-sm" : ""}`}>
          <div className="aspect-[1.25]">
            <Pic name={property.image} alt={`${property.title}, ${property.locality}, Ahmedabad`} className="h-full w-full object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
          </div>
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3.5">
            <BadgeTooltip property={property} />
            <div className="flex gap-2">
              <button
                onClick={onCompare}
                className={`touch-44 hidden place-items-center rounded-full transition-all duration-200 focus-visible:opacity-100 md:grid ${compared ? "bg-night text-ember opacity-100" : "bg-paper/95 text-ink opacity-0 hover:bg-night hover:text-cream group-hover:opacity-100"}`}
                aria-label={compared ? `Remove ${property.title} from compare` : `Compare ${property.title}`} aria-pressed={compared}>
                <Scale size={15} strokeWidth={1.8} />
              </button>
              <button
                onClick={onSave}
                className={`touch-44 grid place-items-center rounded-full transition-all duration-200 ${saved ? "scale-110 bg-brick text-cream" : "bg-paper/95 text-ink hover:bg-brick hover:text-cream"}`}
                aria-label={saved ? `Remove ${property.title} from saved` : `Save ${property.title}`} aria-pressed={saved}>
                <Heart size={16} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          {typeof index === "number" && <span className="stamp absolute bottom-3 left-4 z-10 bg-night/80 px-2 py-1 !text-[10px] text-cream/90">Nº {String(index + 1).padStart(2, "0")}</span>}
        </div>
      </Link>
      <div className="p-5 md:p-6">
        {/* PRIMARY: price + location */}
        <div className="flex items-start justify-between gap-3">
          <strong className="font-display text-[26px] font-semibold leading-none tracking-[-0.025em] text-ink">{property.price}</strong>
          <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-ink/80"><MapPin size={13} className="text-brick" /> {property.locality}</span>
        </div>
        <p className="stamp mt-1 !text-[10px] text-ink/60">{property.pricePerSqft}</p>

        {/* SECONDARY: title + details */}
        <Link href={`/listing/${property.id}`}>
          <h3 className="mt-3 font-display text-[19px] font-medium leading-[1.15] tracking-[-0.015em] text-ink/85 transition-colors group-hover:text-brick">{property.title}</h3>
        </Link>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 stamp !text-[11px] text-ink/60">
          <span className="flex items-center gap-1.5"><BedDouble size={13} /> {property.meta}</span>
          <span className="flex items-center gap-1.5"><Ruler size={13} /> {property.area}</span>
        </div>
        <p className="mt-3 hidden border-l-2 border-brick/50 pl-3 text-xs leading-5 text-ink/60 sm:block">{property.note}</p>

        {/* TERTIARY: freshness + action */}
        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3.5">
          <span className="stamp !text-[10px] text-trust">{property.status}</span>
          <Link href={`/listing/${property.id}`} className="inline-flex min-h-[44px] items-center gap-1 stamp !text-[11px] font-semibold text-brick">View <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
        </div>
      </div>
    </article>
  );
}

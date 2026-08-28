"use client";
/* ARCHITECH — Property card v4: shared persistent saves, responsive WebP images,
   price-first hierarchy, honest demo labels, 44px touch targets. */
import { ArrowUpRight, BedDouble, Heart, MapPin, Ruler, Scale, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Property } from "@/lib/repositories";
import { useSaved } from "@/contexts/SavedContext";
import { useCompare } from "@/contexts/CompareContext";
import { useLang } from "@/contexts/LangContext";
import Pic from "./Pic";
import { secondaryImage } from "@/lib/listing/media";
import { labelForFurnishing } from "@/lib/listing-details";

export type { Property };

export type PropertyCardVariant = "grid" | "horizontal" | "map-preview";

function BadgeTooltip({ property }: { property: Property }) {
  const { t } = useLang();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="flex cursor-help items-center gap-1.5 bg-paper/95 px-2.5 py-1.5 stamp !text-[10px] font-semibold text-ink" aria-label={`${property.badge} — ${t.property.details}`}>
          <ShieldCheck size={12} className="text-trust" /> {property.badge}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[250px] border border-ink/15 bg-night text-cream">
        <p className="stamp !text-[10px] text-ember">GJ/RERA/AHM/2026/0{property.bhk}482 ({t.property.badgeSample})</p>
        <p className="mt-1.5 text-xs leading-5">{t.property.badgeDetailsCopy}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function PropertyCard({ property, arch = false, index, variant = "grid" }: { property: Property; arch?: boolean; index?: number; variant?: PropertyCardVariant }) {
  const { isSaved, toggle } = useSaved();
  const { isCompared, toggle: toggleCompare } = useCompare();
  const { t } = useLang();
  const saved = isSaved(property.id);
  const compared = isCompared(property.id);
  const hoverImage = secondaryImage(property);

  const onSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const nowSaved = toggle(property.id);
    toast(nowSaved ? t.property.savedToast : t.property.removedToast, {
      description: nowSaved ? `${property.title} · ${property.price}` : undefined,
    });
  };

  const onCompare = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    toggleCompare(property.id);
  };

  // Compact map-preview: price + locality bubble, height-constrained.
  if (variant === "map-preview") {
    return (
      <article className="relative overflow-hidden rounded-xl border border-ink/12 bg-card shadow-sm">
        <Link href={`/listing/${property.id}`} aria-label={`View ${property.title}, ${property.price}`} className="block">
          <div className="img-hover relative h-24 bg-sand">
            <Pic name={property.image} alt={`${property.title}, ${property.locality}`} className="h-full w-full object-cover" sizes="160px" />
            <span className="clay-fill absolute bottom-2 left-2 rounded-full bg-brick px-2.5 py-1 font-display text-xs font-semibold text-cream shadow-sm">{property.price}</span>
          </div>
          <div className="flex items-center justify-between p-2.5">
            <p className="text-xs font-semibold text-ink/85">{property.locality} · {property.bhk} BHK</p>
            <motion.button
              onClick={onSave}
              whileTap={{ transform: "scale(0.94)" }}
              animate={saved ? { transform: ["scale(1)", "scale(1.12)", "scale(1)"] } : { transform: "scale(1)" }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              aria-pressed={saved}
              aria-label={saved ? `${t.property.removeSaved} ${property.title}` : `${t.property.save} ${property.title}`}
              className={`touch-44 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${saved ? "bg-brick text-cream" : "bg-paper/90 text-ink hover:bg-brick hover:text-cream"}`}
            >
              <Heart size={14} fill={saved ? "currentColor" : "none"} />
            </motion.button>
          </div>
        </Link>
      </article>
    );
  }

  // Horizontal variant: image left, content right.
  if (variant === "horizontal") {
    return (
      <article className="group relative overflow-hidden rounded-2xl border border-ink/12 bg-card shadow-sm motion-lift hover:editorial-shadow hover:shadow-lg">
        <div className="flex">
          <Link href={`/listing/${property.id}`} className="relative block w-[200px] shrink-0 overflow-hidden bg-sand" aria-label={`View ${property.title}`}>
            <div className="img-hover relative aspect-[4/3]">
              <Pic name={property.image} alt={`${property.title}, ${property.locality}`} className="h-full w-full object-cover" sizes="200px" />
              <img src={`/images/${hoverImage}.jpg`} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 motion-safe:group-hover:opacity-100" loading="lazy" />
            </div>
          </Link>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <strong className="font-display text-xl font-semibold leading-none tracking-[-0.02em]">{property.price}</strong>
              <span className="flex items-center gap-1 text-xs font-semibold text-ink/70"><MapPin size={12} className="text-brick" /> {property.locality}</span>
            </div>
            <p className="stamp mt-1 !text-[9px] text-ink/55">{property.pricePerSqft}</p>
            <h3 className="mt-2 font-display text-base font-medium leading-tight text-ink/85 group-hover:text-brick">{property.title}</h3>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 stamp !text-[10px] text-ink/60"><span className="flex items-center gap-1"><BedDouble size={12} /> {property.meta}</span><span className="flex items-center gap-1"><Ruler size={12} /> {property.area}</span></p>
            <p className="mt-3 flex items-center gap-1.5 stamp !text-[9px] text-trust"><ShieldCheck size={11} /> {property.badge}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative overflow-hidden rounded-[1.25rem] border border-ink/15 border-t-2 border-t-brick/70 bg-card shadow-sm motion-lift hover:editorial-shadow hover:shadow-lg">
      <Link href={`/listing/${property.id}`} className="block" aria-label={`View ${property.title}, ${property.price}, ${property.locality}`}>
        <div className={`img-hover relative bg-sand ${arch ? "arch-frame-sm overflow-hidden" : "rounded-t-2xl"}`}>
          <div className="aspect-[1.25]">
            <Pic name={property.image} alt={`${property.title}, ${property.locality}, Ahmedabad`} className="h-full w-full object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
            {/* Restrained editorial hover: cross-fade a secondary shot, scale 1 -> 1.025 */}
            <img src={`/images/${hoverImage}.jpg`} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 motion-safe:group-hover:opacity-40" loading="lazy" />
          </div>
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3.5">
            <BadgeTooltip property={property} />
            <div className="flex gap-2">
              <button
                onClick={onCompare}
                className={`touch-44 hidden place-items-center rounded-full transition-all duration-200 focus-visible:opacity-100 md:grid ${compared ? "bg-night text-ember opacity-100" : "bg-paper/95 text-ink opacity-0 hover:bg-night hover:text-cream group-hover:opacity-100"}`}
                aria-label={compared ? `${t.property.removeCompare} ${property.title}` : `${t.property.compare} ${property.title}`} aria-pressed={compared}>
                <Scale size={15} strokeWidth={1.8} />
              </button>
              <motion.button
                onClick={onSave}
                whileTap={{ transform: "scale(0.94)" }}
                animate={saved ? { transform: ["scale(1)", "scale(1.1)", "scale(1)"] } : { transform: "scale(1)" }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                className={`touch-44 grid place-items-center rounded-full transition-all duration-200 ${saved ? "bg-brick text-cream" : "bg-paper/95 text-ink hover:bg-brick hover:text-cream"}`}
                aria-label={saved ? `${t.property.removeSaved} ${property.title}` : `${t.property.save} ${property.title}`} aria-pressed={saved}>
                <Heart size={16} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
              </motion.button>
            </div>
          </div>
          {typeof index === "number" && <span className="stamp absolute bottom-3 left-4 z-10 bg-night/80 px-2 py-1 !text-[10px] text-cream/90">Nº {String(index + 1).padStart(2, "0")}</span>}
        </div>
      </Link>
      <div className="p-5 md:p-6">
        <p className="stamp mb-3 !text-[9px] text-ink/45">AHM / {String(index !== undefined ? index + 1 : 1).padStart(2, "0")} · FIELD NOTE</p>
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
        <div className="mt-4 grid grid-cols-3 divide-x divide-ink/10 border-y border-ink/10 py-3">
          <span className="px-2 first:pl-0"><span className="block stamp !text-[9px] text-ink/45">Baths</span><strong className="mt-1 block text-xs font-semibold text-ink/80">{property.details.bathrooms ?? "—"}</strong></span>
          <span className="px-2"><span className="block stamp !text-[9px] text-ink/45">Parking</span><strong className="mt-1 block text-xs font-semibold text-ink/80">{property.details.parkingSpaces ? `${property.details.parkingSpaces} ${property.details.parkingSpaces === 1 ? "space" : "spaces"}` : "No parking"}</strong></span>
          <span className="px-2"><span className="block stamp !text-[9px] text-ink/45">Furnishing</span><strong className="mt-1 block truncate text-xs font-semibold text-ink/80">{labelForFurnishing(property.details.furnishing)}</strong></span>
        </div>
        <p className="mt-3 hidden border-l-2 border-brick/50 pl-3 text-xs leading-5 text-ink/60 sm:block">{property.note}</p>

        {/* TERTIARY: verification + freshness + action */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/10 pt-3.5">
          <span className="flex min-w-0 flex-col">
            <span className="stamp truncate !text-[10px] text-trust">
              <ShieldCheck size={11} className="mr-1 inline" aria-hidden="true" /> {property.badge}
            </span>
            <span className="stamp !text-[9px] text-ink/50">{property.status}</span>
          </span>
          <Link href={`/listing/${property.id}`} className="inline-flex min-h-[44px] shrink-0 items-center gap-1 stamp !text-[11px] font-semibold text-brick">{t.property.view} <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
        </div>
      </div>
    </article>
  );
}

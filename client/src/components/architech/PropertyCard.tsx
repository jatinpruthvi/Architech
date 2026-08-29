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
 <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="flex cursor-help items-center gap-1.5 bg-paper/95 px-2.5 py-1.5 stamp font-semibold text-ink" aria-label={`${property.badge} — ${t.property.details}`}>
 <ShieldCheck size={12} className="text-trust" /> {property.badge}
 </button>
 </TooltipTrigger>
 <TooltipContent side="bottom" className="max-w-[250px] border border-ink/15 bg-night text-cream">
 <p className="stamp text-ember">GJ/RERA/AHM/2026/0{property.bhk}482 ({t.property.badgeSample})</p>
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
 // A real second photograph of THIS listing, or null. Never a stock stand-in.
 const hoverImage = secondaryImage(property);
 // `parkingSpaces === 0` is a fact ("no parking"), not a missing value, so the
 // grid's presence test must not treat it as falsy.
 const parkingLabel = property.details.parkingSpaces === undefined
 ? null
 : property.details.parkingSpaces === 0
 ? "No parking"
 : `${property.details.parkingSpaces} ${property.details.parkingSpaces === 1 ? "space" : "spaces"}`;
 const hasSpecFacts = property.details.bathrooms !== undefined || parkingLabel !== null;

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
 <p className="text-xs font-semibold text-ink">{property.locality} · {property.bhk} BHK</p>
 <motion.button
 onClick={onSave}
 whileTap={{ transform: "scale(0.94)" }}
 animate={saved ? { transform: ["scale(1)", "scale(1.12)", "scale(1)"] } : { transform: "scale(1)" }}
 transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
 aria-pressed={saved}
 aria-label={saved ? `${t.property.removeSaved} ${property.title}` : `${t.property.save} ${property.title}`}
 className={`touch-44 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${saved ? "clay-fill bg-brick text-cream" : "bg-paper/90 text-ink hover:bg-brick"}`}
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
 <Pic name={property.image} alt={`${property.title}, ${property.locality}, ${property.city}`} className="h-full w-full object-cover" sizes="200px" />
 {/* Cross-fade on hover ONLY when this listing really has another
 photo of itself. One photo = no swap, ever. */}
 {hoverImage ? (
 <Pic name={hoverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 motion-safe:group-hover:opacity-100" sizes="200px" />
 ) : null}
 </div>
 </Link>
 <div className="flex flex-1 flex-col p-4">
 <div className="flex items-start justify-between gap-2">
 <strong className="font-display text-xl font-semibold leading-none tracking-[-0.02em]">{property.price}</strong>
 <span className="flex items-center gap-1 text-xs font-semibold text-ink"><MapPin size={12} className="text-brick" /> {property.locality}</span>
 </div>
 <p className="stamp mt-1 ink-3 [font-variant-numeric:tabular-nums]">{property.pricePerSqft}</p>
 <h3 className="mt-2 font-display text-base font-medium leading-tight text-ink group-hover:text-brick">{property.title}</h3>
 <p className="stamp mt-2 flex flex-wrap gap-x-3 gap-y-1 ink-2"><span className="flex items-center gap-1"><BedDouble size={12} /> {property.meta}</span><span className="flex items-center gap-1 [font-variant-numeric:tabular-nums]"><Ruler size={12} /> {property.area}</span></p>
 <p className="mt-3 flex items-center gap-1.5 stamp text-trust"><ShieldCheck size={11} /> {property.badge}</p>
 </div>
 </div>
 </article>
 );
 }

 return (
 <article className="group relative overflow-hidden rounded-[1.25rem] border border-ink/15 border-t-2 border-t-brick/70 bg-card shadow-sm motion-lift hover:editorial-shadow hover:shadow-lg">
 <Link href={`/listing/${property.id}`} className="block" aria-label={`View ${property.title}, ${property.price}, ${property.locality}`}>
 <div className={`img-hover relative bg-sand ${arch ? "arch-frame-sm overflow-hidden" : "rounded-t-2xl"}`}>
 {/* 3:2 — the widest crop a 2-up grid can hold. v4 used
 `aspect-[1.25]`, taller than wide, which cropped the one thing
 people are actually shopping on. */}
 <div className="aspect-[1.5]">
 <Pic name={property.image} alt={`${property.title}, ${property.locality}, ${property.city}`} className="h-full w-full object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
 {/* Restrained editorial hover: scale 1 -> 1.05 (see .img-hover), and
 cross-fade a second photo — but only a real one of THIS listing.
 A single-photo listing keeps its own image; it never ghosts an
 unrelated stock shot over it. */}
 {hoverImage ? (
 <Pic name={hoverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 motion-safe:group-hover:opacity-100" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
 ) : null}
 </div>
 <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3.5">
 <BadgeTooltip property={property} />
 <div className="flex gap-2">
 {/* Always present. v4 gated this on `hidden md:grid` +
 `opacity-0 group-hover:opacity-100`, which meant the compare
 action literally did not exist on touch — a conversion control
 hidden behind a hover affordance. */}
 <button
 onClick={onCompare}
 className={`touch-44 grid place-items-center rounded-full transition-colors duration-200 ${compared ? "bg-night text-ember" : "bg-paper/95 text-ink hover:bg-night hover:text-cream"}`}
 aria-label={compared ? `${t.property.removeCompare} ${property.title}` : `${t.property.compare} ${property.title}`} aria-pressed={compared}>
 <Scale size={15} strokeWidth={1.8} />
 </button>
 <motion.button
 onClick={onSave}
 whileTap={{ transform: "scale(0.94)" }}
 animate={saved ? { transform: ["scale(1)", "scale(1.1)", "scale(1)"] } : { transform: "scale(1)" }}
 transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
 className={`touch-44 grid place-items-center rounded-full transition-all duration-200 ${saved ? "clay-fill bg-brick text-cream" : "bg-paper/95 text-ink hover:bg-brick"}`}
 aria-label={saved ? `${t.property.removeSaved} ${property.title}` : `${t.property.save} ${property.title}`} aria-pressed={saved}>
 <Heart size={16} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
 </motion.button>
 </div>
 </div>
 {typeof index === "number" && <span className="stamp absolute bottom-3 left-4 z-10 bg-night/80 px-2 py-1 text-cream/90">Nº {String(index + 1).padStart(2, "0")}</span>}
 </div>
 </Link>
 <div className="p-5 md:p-6">

 {/* PRIMARY: price + location */}
 <div className="flex items-start justify-between gap-3">
 <strong className="font-display text-[26px] font-semibold leading-none tracking-[-0.025em] text-ink [font-variant-numeric:tabular-nums]">{property.price}</strong>
 <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-ink"><MapPin size={13} className="text-brick" /> {property.locality}</span>
 </div>
 <p className="stamp mt-1.5 ink-2 [font-variant-numeric:tabular-nums]">{property.pricePerSqft}</p>

 {/* SECONDARY: title + details */}
 <Link href={`/listing/${property.id}`}>
 <h3 className="mt-3 font-display text-[19px] font-medium leading-[1.15] tracking-[-0.015em] text-ink transition-colors group-hover:text-brick">{property.title}</h3>
 </Link>
 <div className="stamp mt-3 flex flex-wrap gap-x-4 gap-y-1.5 ink-2">
 <span className="flex items-center gap-1.5"><BedDouble size={13} /> {property.meta}</span>
 <span className="flex items-center gap-1.5"><Ruler size={13} /> {property.area}</span>
 </div>
 {/* The grid renders only when the feed actually carries these facts.
 They arrive today by `JSON.parse(sourceSummary)` (mappers.ts:179)
 with a `catch → {}`, so in production they can be absent listing by
 listing. Three cells reading "—" look like an empty product; no row
 at all reads as a listing that simply has no amenity list yet. */}
 {hasSpecFacts && (
 <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink/12 pt-3">
 <span className="flex min-w-0 flex-col gap-1">
 <span className="block stamp ink-3">Baths</span>
 <strong className="block text-sm font-semibold text-ink [font-variant-numeric:tabular-nums]">{property.details.bathrooms}</strong>
 </span>
 <span className="flex min-w-0 flex-col gap-1 border-l border-ink/12 pl-2">
 <span className="block stamp ink-3">Parking</span>
 <strong className="block text-sm font-semibold text-ink [font-variant-numeric:tabular-nums]">{parkingLabel}</strong>
 </span>
 <span className="flex min-w-0 flex-col gap-1 border-l border-ink/12 pl-2">
 <span className="block stamp ink-3">Furnishing</span>
 <strong className="block truncate text-sm font-semibold text-ink">{labelForFurnishing(property.details.furnishing)}</strong>
 </span>
 </div>
 )}
 <p className="mt-3 hidden border-l-2 border-brick/50 pl-3 text-[13px] leading-5 ink-2 sm:block">{property.note}</p>

 {/* TERTIARY: verification + freshness + action */}
 <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/10 pt-3.5">
 <span className="flex min-w-0 flex-col">
 <span className="stamp truncate text-trust">
 <ShieldCheck size={11} className="mr-1 inline" aria-hidden="true" /> {property.badge}
 </span>
 <span className="stamp mt-0.5 ink-3">{property.status}</span>
 </span>
 <Link href={`/listing/${property.id}`} className="inline-flex min-h-[44px] shrink-0 items-center gap-1 stamp font-semibold text-brick">{t.property.view} <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
 </div>
 </div>
 </article>
 );
}

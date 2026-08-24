"use client";
/* ARCHITECH — Listing dossier v3: honest 404s, lead-form dialog, demo-labelled RERA trail,
   responsive images, locality-linked breadcrumbs. */
import { ArrowUpRight, BedDouble, Check, Clock3, Heart, MapPin, MessageCircle, Ruler, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { properties } from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import Pic from "../components/architech/Pic";
import useTitle from "../hooks/useTitle";
import { useSaved } from "@/contexts/SavedContext";
import { findLocality } from "@/lib/localities";
import { useLang } from "@/contexts/LangContext";

function LeadDialog({ propertyTitle }: { propertyTitle: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOpen(false);
    toast(t.listing.querySent, { description: t.listing.querySentDescription });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn-sweep motion-press mt-8 flex w-full items-center justify-center gap-2 bg-brick px-6 py-5 stamp !text-[12px] font-semibold text-cream"><MessageCircle size={16} /> {t.listing.ask}</button>
      </DialogTrigger>
      <DialogContent className="rounded-none border-ink/15 bg-paper sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-medium tracking-[-0.02em]">{t.listing.dialogTitle}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-ink/60">
            {t.listing.dialogCopy}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-4">
          <div>
            <label htmlFor="lead-name" className="stamp !text-[10px] text-ink/60">{t.listing.name}</label>
            <input id="lead-name" required className="mt-1.5 w-full border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-brick focus:outline-none" placeholder="Kinjal Shah" />
          </div>
          <div>
            <label htmlFor="lead-phone" className="stamp !text-[10px] text-ink/60">{t.listing.phone}</label>
            <input id="lead-phone" required type="tel" pattern="[0-9+ -]{8,}" className="mt-1.5 w-full border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-brick focus:outline-none" placeholder="+91 …" />
          </div>
          <div>
            <label htmlFor="lead-msg" className="stamp !text-[10px] text-ink/60">{t.listing.message}</label>
            <textarea id="lead-msg" rows={3} className="mt-1.5 w-full border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-brick focus:outline-none" defaultValue={`I'd like to know more about "${propertyTitle}".`} />
          </div>
          <button type="submit" className="btn-sweep touch-44 w-full bg-night py-4 stamp !text-[12px] font-semibold text-cream">{t.listing.send}</button>
          <p className="stamp text-center !text-[9px] text-ink/60">{t.listing.noRealMessage}</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ListingPage({ id }: { id: string }) {
  const property = properties.find((p) => p.id === id);
  const { t } = useLang();
  useTitle(property ? `${property.title} — ${property.price}` : "Not found");
  const { isSaved, toggle } = useSaved();
  if (!property) return null;

  const saved = isSaved(property.id);
  const locality = findLocality(property.localitySlug);

  const onSave = () => {
    const nowSaved = toggle(property.id);
    toast(nowSaved ? t.listing.savedToast : t.listing.removedToast, { description: nowSaved ? `${property.title} · ${property.price}` : undefined });
  };

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="container py-10 md:py-14">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 stamp !text-[11px] text-ink/60" aria-label="Breadcrumb">
          <Link href="/" className="link-rail hover:text-brick">{t.listing.breadcrumbHome}</Link><span>/</span>
          <Link href="/buy/ahmedabad/" className="link-rail hover:text-brick">Ahmedabad</Link><span>/</span>
          <Link href={`/buy/ahmedabad/${property.localitySlug}/`} className="link-rail hover:text-brick">{property.locality}</Link><span>/</span>
          <span className="text-ink/80">{property.title}</span>
        </nav>

        {/* Title band */}
        <div className="mt-8 grid gap-6 border-y border-ink/15 bg-sand/70 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-9">
          <div>
            <p className="flex flex-wrap items-center gap-2 stamp !text-[11px] font-semibold text-trust">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex cursor-help items-center gap-1.5 underline decoration-dotted underline-offset-4" aria-label={t.listing.reraDetails}>
                    <ShieldCheck size={14} /> {property.badge}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[270px] border border-ink/15 bg-night text-cream">
                  <p className="stamp !text-[10px] text-ember">{t.listing.reraTooltipKicker}</p>
                  <p className="mt-1.5 text-xs leading-5">{t.listing.reraTooltipCopy}</p>
                </TooltipContent>
              </Tooltip>
              <span aria-hidden="true">·</span> {t.listing.sourceReviewed} <span aria-hidden="true">·</span> {property.status}
            </p>
            <h1 className="display mt-4 max-w-[720px] text-[clamp(34px,4.6vw,60px)]">{property.title}<span className="text-brick">.</span></h1>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/60">
              <span className="flex items-center gap-2"><MapPin size={15} className="text-brick" /> {property.locality}, Ahmedabad</span>
              <span className="flex items-center gap-2"><BedDouble size={15} className="text-brick" /> {property.meta}</span>
              <span className="flex items-center gap-2"><Ruler size={15} className="text-brick" /> {property.area}</span>
            </p>
          </div>
          <div className="border-l-4 border-brick pl-6 md:min-w-[210px]">
            <p className="stamp !text-[10px] text-ink/60">{t.listing.guidePrice}</p>
            <p className="mt-2 font-display text-[40px] font-semibold leading-none tracking-[-0.03em]">{property.price}</p>
            <p className="stamp mt-2 !text-[10px] text-ink/60">{property.pricePerSqft}</p>
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1.45fr_0.8fr]">
          <Reveal>
            <div className="img-hover grain relative min-h-[340px] overflow-hidden bg-sand md:min-h-[540px]">
              <Pic name={property.image} alt={`${property.title} — primary view`} className="absolute inset-0 h-full w-full object-cover" sizes="(max-width: 768px) 100vw, 62vw" eager />
              <span className="stamp absolute left-5 top-5 z-10 bg-paper/95 px-3 py-2 !text-[10px] font-semibold">{t.listing.verifiedView}</span>
            </div>
          </Reveal>
          <div className="grid gap-4 md:grid-rows-2">
            <Reveal delay={100}>
              <div className="img-hover h-full min-h-[200px] overflow-hidden">
                <Pic name="brick-arch" alt="Architectural character of the building" className="h-full w-full object-cover" sizes="(max-width: 768px) 100vw, 34vw" />
              </div>
            </Reveal>
            <Reveal delay={180}>
              <Link href={`/buy/ahmedabad/${property.localitySlug}/`} className="group relative block h-full min-h-[200px] overflow-hidden bg-night">
                <Pic name="locality-street" alt={`Neighbourhood around ${property.locality}`} className="h-full w-full object-cover opacity-60 transition-all duration-700 group-hover:scale-105 group-hover:opacity-75" sizes="(max-width: 768px) 100vw, 34vw" />
                <span className="absolute inset-0 flex items-end p-5 text-sm font-semibold text-cream">{t.listing.neighbourhoodLink} <ArrowUpRight size={15} className="ml-1.5 text-ember transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="container pb-20 md:pb-28">
        <div className="grid gap-14 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex items-start justify-between gap-6">
              <p className="max-w-[600px] text-[15px] leading-8 text-ink/65">{property.note} {t.listing.noteSuffix}</p>
              <button onClick={onSave} aria-pressed={saved} aria-label={saved ? t.listing.removeSaved : t.listing.save}
                className={`touch-44 grid shrink-0 place-items-center border transition-all ${saved ? "border-brick bg-brick text-cream" : "border-ink/20 hover:border-brick hover:text-brick"}`}>
                <Heart size={19} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="mt-10 grid gap-10 border-t border-ink/15 pt-10 md:grid-cols-2">
              <div>
                <p className="kicker text-brick !text-[10px]">{t.listing.why}</p>
                <ul className="mt-6 space-y-4 text-sm text-ink/75">
                  {["Quiet orientation with generous natural light", "Walkable everyday conveniences and schools", "Verified partner with a complete source trail", "Fair pricing against the locality median"].map((t) => (
                    <li key={t} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-trust" /> {t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="kicker text-brick !text-[10px]">{t.listing.trail}</p>
                <div className="mt-6 space-y-0 border-l-2 border-ink/12 pl-5">
                  {[["12 Aug 2026", "Listed by verified partner"], ["19 Aug 2026", "RERA registration re-checked"], ["20 Aug 2026", "Photos & price reviewed"]].map(([date, event]) => (
                    <div key={date} className="relative pb-6 last:pb-0">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-cream bg-brick" />
                      <p className="stamp !text-[10px] text-ink/60">{date}</p>
                      <p className="mt-1 text-sm font-medium text-ink/85">{event}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 flex items-center gap-2 stamp !text-[10px] text-trust"><Clock3 size={13} /> {property.status}</p>
              </div>
            </div>

            {/* Facts strip */}
            <div className="mt-12 grid grid-cols-2 divide-x divide-ink/12 border-y border-ink/12 sm:grid-cols-4">
              {[[t.listing.facts.type, property.meta.split("·")[0].trim()], [t.listing.facts.area, property.area], [t.listing.facts.status, property.meta.split("·")[1]?.trim() ?? "Available"], [t.listing.facts.rate, property.pricePerSqft]].map(([k, v]) => (
                <div key={k} className="px-5 py-6 first:pl-0">
                  <p className="stamp !text-[10px] text-ink/60">{k}</p>
                  <p className="mt-2 font-display text-lg font-medium tracking-[-0.01em]">{v}</p>
                </div>
              ))}
            </div>

            {/* Real OSM neighbourhood map */}
            <div className="mt-12">
              <p className="kicker text-brick !text-[10px]">{t.listing.mapKicker}</p>
              <div className="relative mt-5 h-[320px] border border-ink/12 bg-sand">
                <iframe
                  title={`Map around ${property.locality}, Ahmedabad — OpenStreetMap`}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${locality?.bbox ?? "72.5400,22.9980,72.5800,23.0240"}&layer=mapnik&marker=${locality?.marker ?? "23.011,72.559"}`}
                  className="map-frame absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                />
                <p className="stamp absolute right-3 top-3 bg-paper/90 px-2 py-1 !text-[9px] text-ink/60">© OpenStreetMap contributors</p>
              </div>
              <p className="stamp mt-3 !text-[9px] text-ink/60">{t.listing.exactAddressPrivate}</p>
            </div>
          </div>

          {/* Sticky aside */}
          <aside className="h-fit border border-ink/15 bg-sand/70 p-7 md:p-8 lg:sticky lg:top-[102px]">
            <p className="kicker text-brick !text-[10px]">{t.listing.privateStep}</p>
            <p className="mt-4 font-display text-[30px] font-medium leading-tight tracking-[-0.02em]">{t.listing.talkPartner}</p>
            <p className="mt-3 text-sm leading-6 text-ink/60">{t.listing.maskedCopy}</p>
            <div className="mt-7 border-t border-ink/15 pt-6">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-t-full bg-night font-display text-xl text-cream">N</span>
                <div>
                  <p className="font-semibold">Nivasa Partners</p>
                  <p className="stamp mt-0.5 flex items-center gap-1.5 !text-[10px] text-trust"><ShieldCheck size={11} /> {t.listing.verifiedPartner}</p>
                </div>
              </div>
            </div>
            <LeadDialog propertyTitle={property.title} />
            <p className="stamp mt-4 text-center !text-[10px] text-ink/60">{t.listing.usuallyReplies}</p>
          </aside>
        </div>

        {/* More homes */}
        <div className="mt-20 border-t border-ink/12 pt-14">
          <div className="flex items-end justify-between">
            <h2 className="display text-[clamp(26px,3vw,40px)]">{t.listing.nearbyTitle1} <em className="text-brick">{t.listing.nearbyTitleEm}</em>.</h2>
            <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">{t.listing.allHomes} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {properties.filter((p) => p.id !== property.id).slice(0, 3).map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <Link href={`/listing/${p.id}`} className="group block border border-ink/12 bg-card motion-lift hover:editorial-shadow">
                  <div className="img-hover aspect-[1.4] bg-sand"><Pic name={p.image} alt={p.title} className="h-full w-full object-cover" sizes="(max-width: 640px) 100vw, 33vw" /></div>
                  <div className="p-5">
                    <p className="font-display text-lg font-medium leading-tight tracking-[-0.015em] group-hover:text-brick">{p.title}</p>
                    <div className="mt-2 flex items-center justify-between text-sm text-ink/60"><span>{p.locality}</span><strong className="font-display text-ink">{p.price}</strong></div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

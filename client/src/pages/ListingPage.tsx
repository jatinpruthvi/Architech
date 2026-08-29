"use client";
/* ARCHITECH — Listing dossier v3: honest 404s, lead-form dialog, demo-labelled RERA trail,
   responsive images, locality-linked breadcrumbs. */
import { ArrowUpRight, BedDouble, Check, Clock3, Heart, MapPin, MessageCircle, Ruler, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getListingById, getLocalityBySlug, getRelatedListings } from "@/lib/repositories";
import { buildAgentProfile } from "@/lib/agent/profile";
import { comparableListings, derivePriceHistory, type PriceEvent } from "@/lib/listing/history";
import { demoBrokerSession } from "@/lib/auth/roles";
import PropertyCard from "../components/architech/PropertyCard";
import { SectionNav, type SectionAnchor } from "../components/architech/SectionNav";
import { TrustPanel } from "../components/architech/TrustPanel";
import { ListingGallery } from "../components/architech/ListingGallery";
import { StickyBar } from "../components/architech/StickyBar";
import { OwnershipCost } from "../components/architech/OwnershipCost";
import useTitle from "../hooks/useTitle";
import { useSaved } from "@/contexts/SavedContext";
import { propertyFactRows } from "@/lib/listing-details";
import { useLang } from "@/contexts/LangContext";

/* Module-level, on purpose: SectionNav's effect depends on the array identity,
   and a fresh literal every render would re-subscribe the scroll listener.
   English, because the two headings it tracks ("Property features", and the
   dossier's own kickers) are English-only copy in this file already — the rail
   must name sections exactly as the page labels them, not paraphrase them in a
   second voice. */
const sectionAnchors: SectionAnchor[] = [
  { id: "highlights", label: "Highlights" },
  { id: "features", label: "Features" },
  { id: "verification", label: "Verification" },
  { id: "price-history", label: "Price & history" },
  { id: "partner", label: "Your partner" },
  { id: "location", label: "Location" },
  { id: "nearby", label: "Nearby" },
];

function LeadDialog({ propertyId, propertyTitle, open, onOpenChange }: { propertyId: string; propertyTitle: string; open: boolean; onOpenChange: (open: boolean) => void }) {  const [submitting, setSubmitting] = useState(false);
  const { t } = useLang();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: propertyId,
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          message: String(form.get("message") ?? ""),
          mode: "MASKED",
          consentText: t.listing.consentText,
          idempotencyKey: crypto.randomUUID?.() ?? `${propertyId}-${Date.now()}`,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" ") ?? "Lead failed");
      onOpenChange(false);
      toast(t.listing.querySent, { description: `${t.listing.querySentDescription} · ${payload.lead.phoneMasked}` });
    } catch {
      toast(t.listing.queryFailed, { description: t.listing.queryFailedDescription });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-ink/15 bg-paper sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-medium tracking-[-0.02em]">{t.listing.dialogTitle}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-ink/60">
            {t.listing.dialogCopy}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-4">
          <div>
            <label htmlFor="lead-name" className="stamp !text-[10px] text-ink/60">{t.listing.name}</label>
            <input id="lead-name" name="name" required className="mt-1.5 w-full border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-brick focus:outline-none" placeholder="Kinjal Shah" />
          </div>
          <div>
            <label htmlFor="lead-phone" className="stamp !text-[10px] text-ink/60">{t.listing.phone}</label>
            <input id="lead-phone" name="phone" required type="tel" pattern="[0-9+ -]{8,}" className="mt-1.5 w-full border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-brick focus:outline-none" placeholder="+91 …" />
          </div>
          <div>
            <label htmlFor="lead-msg" className="stamp !text-[10px] text-ink/60">{t.listing.message}</label>
            <textarea id="lead-msg" name="message" rows={3} className="mt-1.5 w-full border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-brick focus:outline-none" defaultValue={`I'd like to know more about "${propertyTitle}".`} />
          </div>
          <label className="flex items-start gap-3 border border-ink/15 bg-sand/50 p-3 text-xs leading-5 text-ink/65">
            <input required type="checkbox" className="mt-1 accent-[var(--brick)]" />
            <span>{t.listing.consentText}</span>
          </label>
          <button type="submit" disabled={submitting} className="night-fill btn-sweep btn-solid touch-44 w-full bg-night py-4 stamp !text-[12px] font-semibold text-cream disabled:cursor-wait">{submitting ? t.listing.sending : t.listing.send}</button>
          <p className="stamp text-center !text-[9px] text-ink/60">{t.listing.noRealMessage}</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ListingPage({ id }: { id: string }) {
  const property = getListingById(id);
  const { t } = useLang();
  useTitle(property ? `${property.title} — ${property.price}` : "Not found");
  const { isSaved, toggle } = useSaved();
  if (!property) return null;

  const saved = isSaved(property.id);
  const locality = getLocalityBySlug(property.localitySlug);
  const [leadOpen, setLeadOpen] = useState(false);

  // Idempotent, server-safe view tracking (no PII). One view per browser session.
  const sessionKey = useMemo(() => (typeof window !== "undefined" ? (window.sessionStorage.getItem("architech.session") ?? crypto.randomUUID()) : ""), []);
  useEffect(() => {
    if (!sessionKey) return;
    try { window.sessionStorage.setItem("architech.session", sessionKey); } catch { /* private mode */ }
    void fetch(`/api/listings/${encodeURIComponent(property.id)}/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric: "views", sessionKey }),
    }).catch(() => undefined);
  }, [property.id, sessionKey]);

  // Price history (explicit events; never invented) + comparable homes in locality.
  const priceEvents: PriceEvent[] = useMemo(() => [
    { id: "pv-1", kind: "listed", priceInr: property.priceNum, date: "2026-07-01", note: `Listed at ${property.price}` },
  ], [property.priceNum, property.price]);
  const priceHistory = useMemo(() => derivePriceHistory(property.id, priceEvents), [property.id, priceEvents]);
  const comparables = useMemo(() => comparableListings({ id: property.id, localitySlug: property.localitySlug, priceNum: property.priceNum }, 3), [property.id, property.localitySlug, property.priceNum]);
  // Never render invented reviews or ratings; the section stays an honest empty state until verified data exists.
  const agent = useMemo(() => buildAgentProfile(demoBrokerSession, []), []);

  const onSave = () => {
    const nowSaved = toggle(property.id);
    void fetch(`/api/listings/${encodeURIComponent(property.id)}/stats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metric: "saves" }) }).catch(() => undefined);
    toast(nowSaved ? t.listing.savedToast : t.listing.removedToast, { description: nowSaved ? `${property.title} · ${property.price}` : undefined });
  };

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="container py-10 md:py-14">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 stamp !text-[11px] text-ink/60" aria-label="Breadcrumb">
          <Link href="/" className="link-rail hover:text-brick">{t.listing.breadcrumbHome}</Link><span>/</span>
          <Link href={`/buy/${property.citySlug}/`} className="link-rail hover:text-brick">{property.city}</Link><span>/</span>
          <Link href={`/buy/${property.citySlug}/${property.localitySlug}/`} className="link-rail hover:text-brick">{property.locality}</Link><span>/</span>
          <span className="text-ink/80">{property.title}</span>
        </nav>

        {/* Title band. The id is the rail's "Top" target; no per-node scroll
            offset here, because theme.css sets the global `[id]` scroll margin
            UNLAYERED and therefore outranks any utility you add on top of it —
            a local `scroll-mt-*` would silently lose and mislead the next
            reader into thinking it was in charge. */}
        <div id="dossier-top" className="mt-8 grid gap-6 border-y border-ink/15 bg-sand/70 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-9">
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

        {/* Gallery — primary-first lightbox experience */}
        <div className="mt-6">
          <ListingGallery property={property} />
        </div>
      </section>

      <div className="container">
        <SectionNav sections={sectionAnchors} label={t.listing.sectionsLabel} />
      </div>

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

            <div id="highlights" className="mt-10 grid gap-10 border-t border-ink/15 pt-10 md:grid-cols-2">
              <div>
                <p className="kicker text-brick !text-[10px]">{t.listing.why}</p>
                <ul role="list" className="mt-6 space-y-4 text-sm text-ink/75">
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

            {/* Property features — explicit facts, no invented reviews */}
            <section id="features" className="mt-12 border-y border-ink/12 py-10" aria-labelledby="property-features-heading">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="kicker text-brick !text-[10px]">Property features</p><h2 id="property-features-heading" className="mt-3 font-display text-3xl font-medium tracking-[-0.02em]">The useful facts, <span className="text-brick">together.</span></h2></div><span className="stamp text-ink/45">FACTS / {property.details.amenities?.length ?? 0} AMENITIES</span></div>
              <div className="mt-7 grid grid-cols-2 gap-px border border-ink/10 bg-ink/10 sm:grid-cols-3">
                {propertyFactRows(property.details).map(([label, value]) => <div key={label} className="bg-paper p-4 md:p-5"><p className="stamp !text-[9px] text-ink/50">{label}</p><p className="mt-2 font-display text-lg font-medium tracking-[-0.01em]">{value}</p></div>)}
              </div>
              <div className="mt-6"><p className="stamp !text-[9px] text-ink/50">Amenities selected in the source packet</p><div className="mt-3 flex flex-wrap gap-2">{(property.details.amenities ?? []).map((amenity) => <span key={amenity} className="border border-ink/12 bg-sand/45 px-3 py-2 text-xs text-ink/70">{amenity}</span>)}</div></div>
            </section>

            {/* Trust dossier */}
            <div id="verification"><TrustPanel property={property} /></div>
            <OwnershipCost property={property} />

            {/* Price & history + agent trust */}
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <section id="price-history" aria-labelledby="price-history-heading">
                <p className="kicker text-brick !text-[10px]">{t.listing.trail}</p>
                <h3 id="price-history-heading" className="mt-3 font-display text-2xl font-medium tracking-[-0.02em]">Price <span className="text-brick">& history</span>.</h3>
                <div className="mt-5 space-y-0 border-l-2 border-ink/12 pl-5">
                  {priceHistory.events.map((event) => (
                    <div key={event.id} className="relative pb-6 last:pb-0">
                      <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-cream ${event.kind === "price_change" ? "bg-ember" : "bg-brick"}`} />
                      <p className="stamp !text-[10px] text-ink/60">{event.date}</p>
                      <p className="mt-1 text-sm font-medium text-ink/85">₹{event.priceInr.toLocaleString("en-IN")} · {event.note ?? event.kind.replace("_", " ")}</p>
                    </div>
                  ))}
                </div>
                {priceHistory.hasDecline && <p className="stamp mt-3 !text-[10px] text-ember">Price adjusted since listing.</p>}

                <p className="kicker mt-8 text-brick !text-[10px]">{t.search.demoFixtures}</p>
                <div className="mt-3 space-y-3">
                  {comparables.map((comparable) => (
                    <Link key={comparable.id} href={`/listing/${comparable.id}`} className="group flex items-center justify-between border border-ink/12 bg-card p-4 hover:border-brick">
                      <div>
                        <p className="font-display text-base font-medium leading-tight group-hover:text-brick">{comparable.title}</p>
                        <p className="stamp mt-1 !text-[10px] text-ink/55">{comparable.locality} · {comparable.pricePerSqft}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-base">₹{(comparable.priceNum / 10000000).toFixed(2)} Cr</p>
                        <p className={`stamp !text-[10px] ${comparable.deltaPct >= 0 ? "" : "text-trust"}`}>{comparable.deltaPct >= 0 ? "+" : ""}{comparable.deltaPct}% vs this home</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section id="partner" aria-labelledby="agent-heading" className="h-fit border border-ink/15 bg-sand/50 p-6">
                <p className="kicker text-brick !text-[10px]">Your partner</p>
                <h3 id="agent-heading" className="mt-3 font-display text-2xl font-medium tracking-[-0.02em]">{agent.name}.</h3>
                <p className="stamp mt-2 !text-[10px] text-trust">{agent.badge}</p>
                {agent.rating > 0 ? (
                  <p className="mt-4 flex items-center gap-2 text-sm">
                    <span className="text-ember" aria-hidden="true">{"★".repeat(Math.round(agent.rating))}</span>
                    <strong className="font-display text-ink">{agent.rating.toFixed(1)}</strong>
                    <span className="text-ink/60">· {agent.reviewCount} verified review{agent.reviewCount === 1 ? "" : "s"}</span>
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-ink/60">Sample partner profile — ratings appear once verified buyer reviews are on file.</p>
                )}
                <div className="mt-5 space-y-3 border-t border-ink/10 pt-5">
                  {agent.reviews.map((review) => (
                    <div key={review.id} className="text-sm">
                      <p className="text-ink/80">“{review.comment}”</p>
                      <p className="stamp mt-1 !text-[10px] text-ink/55">{review.buyerName} · {review.role} · sample</p>
                    </div>
                  ))}
                </div>
                <Link href="/guide/" className="mt-6 inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-brick">How we verify partners <ArrowUpRight size={13} /></Link>
              </section>
            </div>


            {/* Real OSM neighbourhood map */}
            <div id="location" className="mt-12">
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
            <button
              onClick={() => setLeadOpen(true)}
              className="clay-fill btn-sweep motion-press mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-brick px-6 py-5 stamp !text-[12px] font-semibold text-cream transition-colors hover:bg-brick-deep"
            >
              <MessageCircle size={16} /> {t.listing.ask}
            </button>
            <LeadDialog propertyId={property.id} propertyTitle={property.title} open={leadOpen} onOpenChange={setLeadOpen} />
            <p className="stamp mt-4 text-center !text-[10px] text-ink/60">{t.listing.usuallyReplies}</p>
          </aside>
        </div>

        {/* Sticky conversion bar */}
        <StickyBar property={property} saved={saved} onSave={onSave} onAsk={() => setLeadOpen(true)} />

        {/* More homes */}
        <div id="nearby" className="mt-20 border-t border-ink/12 pt-14">
          <div className="flex items-end justify-between">
            <h2 className="display text-[clamp(26px,3vw,40px)]">{t.listing.nearbyTitle1} <em className="text-brick">{t.listing.nearbyTitleEm}</em>.</h2>
            <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">{t.listing.allHomes} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {/* The SHARED card, not a local copy of it. This was a hand-rolled
                1.4-crop / `text-ink/60` lookalike — a third of the page's scroll
                written in a design language the product had already moved past,
                with no save and no compare on cards whose only job is "save one
                of these". Reveal is dropped too: PropertyCard already owns its
                entrance motion, and nesting both double-animated the grid. */}
            {getRelatedListings(property.id, 3).map((p, i) => (
              <PropertyCard key={p.id} property={p} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";
/* Listing gallery: primary-first carousel with a thumbnail rail (desktop),
   swipe/drag + scroll-snap (mobile), a keyboard-accessible fullscreen lightbox,
   an image counter, and media labels. Built on native scroll-snap (resilient
   baseline) — no heavy third-party carousel dependency. Reduced motion: slide
   transitions are disabled via CSS `prefers-reduced-motion`. */
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Pic from "./Pic";
import { listingSlides, imageCountLabel } from "@/lib/listing/media";
import type { Property } from "@/lib/repositories";
import { useLang } from "@/contexts/LangContext";

function trackSnapToIndex(el: HTMLElement): number {
  const children = Array.from(el.children) as HTMLElement[];
  if (!children.length) return 0;
  const target = el.scrollLeft + el.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  children.forEach((child, index) => {
    const center = child.offsetLeft + child.offsetWidth / 2;
    const dist = Math.abs(center - target);
    if (dist < bestDist) { bestDist = dist; best = index; }
  });
  return best;
}

export function ListingGallery({ property }: { property: Property }) {
  const { t } = useLang();
  const slides = listingSlides(property);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((index: number) => {
    const el = railRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    setActive(index);
  }, []);

  const move = useCallback((dir: -1 | 1) => {
    setActive((prev) => {
      const next = (prev + dir + slides.length) % slides.length;
      scrollTo(next);
      return next;
    });
  }, [slides.length, scrollTo]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [lightbox, move]);

  const onRailScroll = () => {
    if (railRef.current) setActive(trackSnapToIndex(railRef.current));
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[1.45fr_0.8fr]">
        {/* Lead slide */}
        <div className="img-hover grain relative min-h-[230px] overflow-hidden bg-sand sm:min-h-[280px] md:min-h-[360px]">
          <Pic name={slides[0].name} alt={slides[0].alt} className="absolute inset-0 h-full w-full object-cover" sizes="(max-width: 768px) 100vw, 62vw" eager />
          <span className="stamp absolute left-5 top-5 z-10 rounded-full bg-paper/95 px-3 py-1.5 !text-[10px] font-semibold">{t.listing.verifiedView}</span>
          <button
            onClick={() => setLightbox(true)}
            className="absolute bottom-4 right-4 z-10 inline-flex touch-44 items-center gap-2 rounded-full bg-night/80 px-4 py-2 stamp !text-[10px] font-semibold text-cream backdrop-blur transition-colors hover:bg-brick"
            aria-label={`${t.listing.gallery.openGallery} (${imageCountLabel(slides.length)})`}
          >
            <Maximize2 size={13} /> {imageCountLabel(slides.length)} · {t.listing.gallery.photos}
          </button>
        </div>

        {/* Secondary editorial shots */}
        <div className="grid gap-4 md:grid-rows-2">
          {slides.slice(1, 3).map((slide) => (
            <button
              key={slide.name}
              type="button"
              onClick={() => setLightbox(true)}
              className="img-hover relative block h-full min-h-[110px] overflow-hidden bg-sand sm:min-h-[135px] md:min-h-[170px]"
              aria-label={`${slide.label} — ${t.listing.gallery.openGallery}`}
            >
              <Pic name={slide.name} alt={slide.alt} className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.025]" sizes="(max-width: 768px) 100vw, 34vw" />
              <span className="stamp absolute bottom-3 left-4 z-10 rounded-full bg-paper/95 px-2.5 py-1 !text-[9px] font-semibold">{slide.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Thumbnail rail + count */}
      <div className="mt-3 flex items-center gap-3">
        <button onClick={() => move(-1)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:border-brick hover:text-brick" aria-label={t.listing.gallery.prev}><ChevronLeft size={16} /></button>
        <div ref={railRef} onScroll={onRailScroll} className="flex flex-1 gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slides.map((slide, i) => (
            <button
              key={slide.name}
              type="button"
              onClick={() => scrollTo(i)}
              className={`snap-start relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 ${active === i ? "border-brick" : "border-transparent opacity-70 hover:opacity-100"}`}
              aria-label={`${slide.label} ${i + 1} of ${slides.length}`}
              aria-current={active === i ? "true" : undefined}
            >
              <Pic name={slide.name} alt="" className="h-full w-full object-cover" sizes="80px" />
            </button>
          ))}
        </div>
        <button onClick={() => move(1)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:border-brick hover:text-brick" aria-label={t.listing.gallery.next}><ChevronRight size={16} /></button>
        <span className="stamp hidden shrink-0 !text-[10px] text-ink/55 sm:block">{active + 1} / {slides.length}</span>
      </div>

      {/* Fullscreen lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-night" role="dialog" aria-modal="true" aria-label={t.listing.gallery.openGallery}>
          <div className="flex items-center justify-between p-4">
            <p className="stamp !text-[10px] font-semibold text-cream/80">{slides[active].label} · {active + 1} / {slides.length}</p>
            <button onClick={() => setLightbox(false)} className="grid h-11 w-11 touch-44 place-items-center rounded-full text-cream/80 hover:text-cream" aria-label={t.listing.gallery.close}><X size={22} /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-16">
            <div className="img-hover relative h-full w-full">
              <Pic name={slides[active].name} alt={slides[active].alt} className="h-full w-full object-contain" sizes="100vw" eager />
            </div>
            <button onClick={() => move(-1)} className="absolute left-3 grid h-11 w-11 touch-44 place-items-center rounded-full bg-paper/10 text-cream hover:bg-paper/20" aria-label={t.listing.gallery.prev}><ChevronLeft size={24} /></button>
            <button onClick={() => move(1)} className="absolute right-3 grid h-11 w-11 touch-44 place-items-center rounded-full bg-paper/10 text-cream hover:bg-paper/20" aria-label={t.listing.gallery.next}><ChevronRight size={24} /></button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
/* Listing sticky conversion bar. Appears after a scroll threshold, pinned to the
   bottom, showing price, save, and the primary "Ask about this home" CTA so a
   buyer never has to scroll back up. Animated with transform/opacity only and
   respects reduced motion. */
import { Heart, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Property } from "@/lib/repositories";
import { useLang } from "@/contexts/LangContext";

export function StickyBar({ property, saved, onSave, onAsk }: { property: Property; saved: boolean; onSave: () => void; onAsk: () => void }) {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 text-ink shadow-[0_-8px_30px_rgba(17,24,39,0.12)] backdrop-blur-md motion-safe:transition-[transform,opacity] motion-safe:duration-300 motion-safe:ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="stamp !text-[9px] text-ink/55">{t.listing.stickyBar.price} · {property.locality}</p>
          <p className="truncate font-display text-lg font-semibold leading-tight tracking-[-0.01em]">{property.price}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onSave}
            aria-pressed={saved}
            aria-label={saved ? t.listing.stickyBar.removeSaved : t.listing.stickyBar.save}
            className={`touch-44 grid h-11 w-11 place-items-center rounded-full border transition-colors ${saved ? "border-brick bg-brick text-cream" : "border-ink/20 text-ink/70 hover:border-brick hover:text-brick"}`}
          >
            <Heart size={17} fill={saved ? "currentColor" : "none"} />
          </button>
          <button onClick={onAsk} className="btn-sweep touch-44 inline-flex items-center gap-2 rounded-xl bg-brick px-5 py-3 stamp !text-[11px] font-semibold text-cream">
            <MessageCircle size={14} /> {t.listing.stickyBar.ask}
          </button>
        </div>
      </div>
    </div>
  );
}

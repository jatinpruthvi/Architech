"use client";
/* ARCHITECH — Saved homes: real persisted shortlist from SavedContext. */
import { ArrowUpRight, Bookmark } from "lucide-react";
import Link from "next/link";
import PropertyCard, { properties } from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import useTitle from "../hooks/useTitle";
import { useSaved } from "@/contexts/SavedContext";

export default function Saved() {
  const { saved } = useSaved();
  const savedHomes = properties.filter((p) => saved.includes(p.id));
  useTitle(savedHomes.length ? `Saved homes (${savedHomes.length})` : "Saved homes");

  if (savedHomes.length === 0) {
    return (
      <div className="bg-paper pt-[78px] text-ink">
        <section className="container flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-t-full bg-sand text-brick"><Bookmark size={28} /></span>
          <h1 className="display mt-8 max-w-[560px] text-[clamp(34px,4.6vw,60px)]">Nothing saved — <em className="text-brick">yet</em>.</h1>
          <p className="mt-5 max-w-[400px] text-[15px] leading-7 text-ink/60">Tap the heart on any home and it will wait for you here, freshness stamps and all.</p>
          <Link href="/search" className="btn-sweep motion-press mt-10 inline-flex items-center gap-2 bg-brick px-8 py-5 stamp !text-[12px] font-semibold text-cream">Find a home worth saving <ArrowUpRight size={15} /></Link>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Your shortlist</p>
          <h1 className="display mt-6 text-[clamp(36px,5vw,68px)]">{savedHomes.length} {savedHomes.length === 1 ? "home" : "homes"}, <em className="text-brick">waiting</em>.</h1>
          <p className="mt-5 max-w-[440px] text-[15px] leading-7 text-ink/60">Saved on this device. Freshness stamps keep ticking — if a fact changes, you'll see it here first.</p>
        </div>
      </section>
      <section className="container py-14 md:py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedHomes.map((property, i) => (
            <Reveal key={property.id} delay={i * 70}><PropertyCard property={property} index={i} /></Reveal>
          ))}
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-ink/10 pt-6">
          <p className="stamp !text-[11px] text-ink/60">Tip: tap the heart again to remove a home.</p>
          <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">Keep exploring <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
        </div>
      </section>
    </div>
  );
}

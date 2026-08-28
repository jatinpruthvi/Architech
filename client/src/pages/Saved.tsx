"use client";
/* ARCHITECH — Saved homes: real persisted shortlist from SavedContext. */
import { ArrowUpRight, Bookmark } from "lucide-react";
import Link from "next/link";
import PropertyCard from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";
import useTitle from "../hooks/useTitle";
import { useSaved } from "@/contexts/SavedContext";
import { useLang } from "@/contexts/LangContext";
import { getListings } from "@/lib/repositories";

export default function Saved() {
  const { saved } = useSaved();
  const { t } = useLang();
  const savedHomes = getListings().filter((p) => saved.includes(p.id));
  useTitle(savedHomes.length ? `${t.saved.title} (${savedHomes.length})` : t.saved.title);

  if (savedHomes.length === 0) {
    return (
      <div className="bg-paper pt-[78px] text-ink">
        <section className="container flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-t-full bg-sand text-brick"><Bookmark size={28} /></span>
          <h1 className="display mt-8 max-w-[560px] text-[clamp(34px,4.6vw,60px)]">{t.saved.emptyTitle1} <em className="text-brick">{t.saved.emptyTitleEm}</em>.</h1>
          <p className="mt-5 max-w-[400px] text-[15px] leading-7 text-ink/60">{t.saved.emptyCopy}</p>
          {t.common.translationNote && <p className="stamp mt-4 max-w-[420px] !text-[10px] text-ink/55">{t.common.translationNote}</p>}
          <Link href="/search" className="clay-fill btn-sweep motion-press mt-10 inline-flex items-center gap-2 bg-brick px-8 py-5 stamp !text-[12px] font-semibold text-cream">{t.saved.emptyCta} <ArrowUpRight size={15} /></Link>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">{t.saved.shortlist}</p>
          <h1 className="display mt-6 text-[clamp(36px,5vw,68px)]">{savedHomes.length} {savedHomes.length === 1 ? t.search.home : t.search.homes}, <em className="text-brick">{t.saved.waiting}</em>.</h1>
          <p className="mt-5 max-w-[440px] text-[15px] leading-7 text-ink/60">{t.saved.savedOnDevice}</p>
          {t.common.translationNote && <p className="stamp mt-4 max-w-[520px] !text-[10px] text-ink/55">{t.common.translationNote}</p>}
        </div>
      </section>
      <section className="container py-14 md:py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedHomes.map((property, i) => (
            <Reveal key={property.id} delay={i * 70}><PropertyCard property={property} index={i} /></Reveal>
          ))}
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-ink/10 pt-6">
          <p className="stamp !text-[11px] text-ink/60">{t.saved.tip}</p>
          <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">{t.saved.keepExploring} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
        </div>
      </section>
    </div>
  );
}

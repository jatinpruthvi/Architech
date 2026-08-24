"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, FileCheck2, UserRoundCheck } from "lucide-react";
import Pic from "@/components/architech/Pic";
import Reveal from "@/components/architech/Reveal";
import useTitle from "@/hooks/useTitle";
import type { Guide } from "@/lib/repositories";

export default function GuideArticle({ guide }: { guide: Guide }) {
  useTitle(guide.title);
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 stamp !text-[11px] text-ink/60" aria-label="Breadcrumb">
            <Link href="/" className="link-rail hover:text-brick">Home</Link><span>/</span>
            <Link href="/guide/" className="link-rail hover:text-brick">Field notes</Link><span>/</span>
            <span className="text-ink/80">{guide.title}</span>
          </nav>
          <p className="kicker mt-12 text-brick">{guide.tag} · {guide.time}</p>
          <h1 className="display mt-6 max-w-[880px] text-[clamp(40px,6vw,84px)]">{guide.title}</h1>
          <p className="mt-7 max-w-[680px] text-base leading-8 text-ink/65 md:text-lg">{guide.summary}</p>
          <div className="mt-8 flex flex-wrap gap-3 stamp !text-[10px] text-ink/60">
            <span className="inline-flex items-center gap-1.5"><UserRoundCheck size={13} /> {guide.author}</span>
            <span className="inline-flex items-center gap-1.5"><FileCheck2 size={13} /> {guide.reviewer}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> Updated {guide.updatedAt}</span>
          </div>
          {guide.status !== "published" && <p className="mt-5 max-w-[620px] border-l-2 border-brick pl-4 text-sm leading-6 text-ink/60">Editorial review in progress. This page is available for product review but remains noindex until sources and reviewer approval are complete.</p>}
        </div>
      </section>

      <section className="container grid gap-12 py-14 lg:grid-cols-[1fr_340px] md:py-20">
        <article className="space-y-10">
          <Reveal>
            <div className="arch-frame-sm img-hover grain editorial-shadow">
              <Pic name={guide.image} alt="" className="aspect-[1.7] w-full object-cover" sizes="(max-width: 768px) 100vw, 70vw" />
            </div>
          </Reveal>
          {guide.sections.map((section, index) => (
            <Reveal key={section.heading} delay={index * 70}>
              <section className="border-t border-ink/12 pt-7">
                <h2 className="font-display text-3xl font-medium tracking-[-0.02em]">{section.heading}</h2>
                <p className="mt-4 max-w-[720px] text-[15px] leading-8 text-ink/65">{section.body}</p>
              </section>
            </Reveal>
          ))}
        </article>

        <aside className="h-fit border border-ink/12 bg-card p-6 lg:sticky lg:top-[102px]">
          <p className="kicker text-brick !text-[10px]">Sources and status</p>
          <div className="mt-5 space-y-4">
            {guide.sources.map((source) => (
              <div key={source.label} className="border-t border-ink/10 pt-4">
                <p className="font-semibold">{source.url ? <a href={source.url} className="link-rail text-brick" target="_blank" rel="noreferrer">{source.label}</a> : source.label}</p>
                <p className="mt-1 text-xs leading-5 text-ink/60">{source.note}</p>
              </div>
            ))}
          </div>
          <Link href="/search" className="btn-sweep motion-press mt-7 inline-flex items-center gap-2 bg-brick px-5 py-4 stamp !text-[12px] font-semibold text-cream">Use this in search <ArrowUpRight size={14} /></Link>
        </aside>
      </section>
    </div>
  );
}

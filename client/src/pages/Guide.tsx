"use client";
/* ARCHITECH — Field notes / methodology: how verification, sources, and freshness work. */
import { ArrowUpRight, FileSearch, ShieldCheck, Timer } from "lucide-react";
import Link from "next/link";
import Reveal from "../components/architech/Reveal";
import Pic from "../components/architech/Pic";
import useTitle from "../hooks/useTitle";
import { getGuides } from "@/lib/repositories";

export default function Guide() {
  useTitle("Field notes — how we verify");
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-16 md:py-24">
        <div className="container">
          <p className="kicker text-brick">Field notes</p>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,84px)]">How we read a city — and <em className="text-brick">prove</em> what we publish.</h1>
          <p className="mt-7 max-w-[520px] text-base leading-8 text-ink/65">Our methodology, locality studies, and essays on building trust into real-estate discovery. Everything we claim, we source.</p>
        </div>
      </section>

      <section className="container grid gap-10 py-16 md:grid-cols-3 md:py-24">
        {([[ShieldCheck, "RERA first", "Registration numbers are checked at listing time and re-checked on every meaningful update."], [FileSearch, "Sources in view", "Partner submissions, documents, and registry data are cited on the page — not stored behind a wall."], [Timer, "Freshness stamps", "Every fact carries the date it was last reviewed. Stale data announces itself."]] as const).map(([Icon, title, body], i) => (
          <Reveal key={title} delay={i * 90}>
            <div className="border-t-2 border-brick pt-6">
              <Icon size={20} className="text-brick" />
              <p className="mt-4 font-display text-2xl font-medium tracking-[-0.015em]">{title}</p>
              <p className="mt-3 text-sm leading-6 text-ink/60">{body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="border-t border-ink/12 bg-sand/60 py-16 md:py-24">
        <div className="container">
          <Reveal><h2 className="display text-[clamp(28px,3.6vw,48px)]">Latest notes<span className="text-brick">.</span></h2></Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {getGuides().map((n, i) => (
              <Reveal key={n.title} delay={i * 90}>
                <article className="group border border-ink/12 bg-card motion-lift hover:editorial-shadow">
                  <div className="img-hover aspect-[1.35] bg-sand"><Pic name={n.image} alt="" className="h-full w-full object-cover" sizes="(max-width: 640px) 100vw, 33vw" /></div>
                  <div className="p-6">
                    <p className="stamp !text-[10px] text-brick">{n.tag} · {n.time}</p>
                    <h3 className="mt-3 font-display text-[22px] font-medium leading-snug tracking-[-0.02em] group-hover:text-brick">{n.title}</h3>
                    <p className="mt-4 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-ink/60">In the studio — publishing soon</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="mt-14 flex flex-col items-start justify-between gap-6 border border-ink/12 bg-card p-8 md:flex-row md:items-center md:p-10">
              <p className="max-w-[520px] font-display text-2xl font-medium leading-snug tracking-[-0.015em]">Ready to put the method to work?</p>
              <Link href="/search" className="btn-sweep motion-press inline-flex items-center gap-2 bg-brick px-7 py-4 stamp !text-[12px] font-semibold text-cream">Start exploring <ArrowUpRight size={15} /></Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

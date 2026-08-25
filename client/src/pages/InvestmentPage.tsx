"use client";
/* Amdavad Modern investment lens: editorial context, not personalized financial advice. */
import Link from "next/link";
import { ArrowUpRight, Check, Compass, FileCheck2 } from "lucide-react";
import Reveal from "@/components/architech/Reveal";

const lenses = [
  ["Movement", "Follow access before aspiration: metro, arterial roads, daily services, and the time a neighbourhood gives back."],
  ["Supply", "Compare what is being built, what is ready, and what is actually documented instead of relying on launch language."],
  ["Evidence", "A registration trail, a freshness date, and a visible source are more useful than a confident promise."],
];

export default function InvestmentPage() {
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-night py-20 text-cream md:py-32"><div className="container grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-end"><Reveal><p className="kicker text-ember">Ahmedabad investment lens · editorial</p><h1 className="display mt-6 max-w-[900px] text-[clamp(46px,8vw,110px)]">Read the city before you read the <em className="text-ember">price.</em></h1><p className="mt-7 max-w-xl text-[15px] leading-7 text-cream/70">A calm field guide to the signals behind an address: movement, supply, use, documentation, and the everyday life a locality can support.</p></Reveal><Reveal delay={120} className="border-l-2 border-ember pl-6"><Compass size={24} className="text-ember" /><p className="mt-5 font-display text-3xl">No promises. Better questions.</p><p className="mt-3 text-sm leading-6 text-cream/60">This page is general information, not individualized investment, tax, or legal advice.</p></Reveal></div></section>
      <section className="container py-20 md:py-28"><div className="grid gap-10 md:grid-cols-3">{lenses.map(([title, copy], index) => <Reveal key={title} delay={index * 80}><article className="border-t-2 border-brick pt-5"><p className="index-num text-4xl text-brick/75">{String(index + 1).padStart(2, "0")}</p><h2 className="mt-8 font-display text-3xl font-medium tracking-[-0.03em]">{title}</h2><p className="mt-4 text-sm leading-7 text-ink/65">{copy}</p></article></Reveal>)}</div></section>
      <section className="border-y border-ink/12 bg-sand/60 py-20 md:py-28"><div className="container grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start"><div><p className="kicker text-brick">A due-diligence prompt</p><h2 className="display mt-5 max-w-xl text-[clamp(36px,5vw,64px)]">Ask for the <em className="text-brick">record.</em></h2><p className="mt-5 max-w-lg text-sm leading-7 text-ink/65">Before acting on any property, independently verify title, approvals, taxes, construction status, financing terms, and the current RERA record with qualified professionals.</p></div><div className="grid gap-4">{["What is the source and date of each material claim?", "What changes if the handover, approval, or access assumption changes?", "Which costs are outside the quoted price?", "Who is accountable for the next documented step?"].map((question) => <div key={question} className="flex items-start gap-4 border-b border-ink/15 py-4"><FileCheck2 size={18} className="mt-1 shrink-0 text-trust" /><p className="font-display text-xl tracking-[-0.02em]">{question}</p></div>)}</div></div></section>
      <section className="container py-20 md:py-28"><div className="border border-ink/15 bg-paper p-7 md:p-10"><div className="flex items-start gap-4"><Check size={20} className="mt-1 text-trust" /><div><h2 className="font-display text-3xl font-medium">Continue with verified context.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">Explore Ahmedabad localities, inspect listing source trails, and use the requirement brief when you need a human partner to help narrow the search.</p><div className="mt-6 flex flex-wrap gap-4"><Link href="/buy/ahmedabad/" className="inline-flex items-center gap-2 bg-brick px-5 py-3 stamp !text-[11px] font-semibold text-cream">Explore localities <ArrowUpRight size={14} /></Link><Link href="/guide/" className="inline-flex items-center gap-2 border border-ink/20 px-5 py-3 stamp !text-[11px] font-semibold text-ink/70 hover:border-brick hover:text-brick">Read field notes <ArrowUpRight size={14} /></Link></div></div></div></div></section>
    </div>
  );
}

/* Architech Editorial Terracotta: image-led homepage, trust-visible discovery, restrained hero motion, and crawlable public links. */
import { ArrowDownRight, ArrowUpRight, Compass, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import PropertyCard, { properties } from "../components/architech/PropertyCard";

const localities = [
  { name: "Bandra West", note: "Sea breeze, independent cafes", count: "128 homes" },
  { name: "Powai", note: "Gardens, schools, easy commutes", count: "94 homes" },
  { name: "Khar West", note: "Quiet lanes, a lively centre", count: "76 homes" },
];

export default function Home() {
  return <div className="overflow-hidden bg-paper text-ink">
    <section className="relative min-h-[720px] bg-[#d7c8b4] pt-[76px]">
      <img src="/manus-storage/architech-hero-mumbai_5bc9095e.jpg" alt="Warm evening view across a Mumbai residential neighbourhood" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(35,28,22,.8)_0%,rgba(35,28,22,.45)_44%,rgba(35,28,22,.08)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(35,28,22,.48)_0%,transparent_45%)]" />
      <div className="container relative flex min-h-[644px] items-end pb-16 pt-24 md:pb-24">
        <div className="max-w-[720px] text-paper">
          <p className="arch-line arch-rise text-[11px] font-semibold uppercase tracking-[.24em] text-[#f0b59b]">India, considered differently</p>
          <h1 className="arch-rise arch-rise-delay-1 mt-6 max-w-[670px] font-display text-[clamp(3.1rem,8vw,7.2rem)] font-medium leading-[.88] tracking-[-.065em]">Find the neighbourhood before you choose the address.</h1>
          <p className="arch-rise arch-rise-delay-2 mt-7 max-w-[480px] text-base leading-7 text-paper/80 md:text-lg">A calmer way to discover homes, projects, and the places around them—with evidence you can actually use.</p>
          <div className="arch-rise arch-rise-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/search" className="group inline-flex items-center justify-between gap-12 bg-paper px-5 py-4 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-1"><span>Start with a city or locality</span><ArrowUpRight size={18} className="text-clay transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
            <Link href="/buy/mumbai/" className="inline-flex items-center gap-2 border border-paper/40 px-5 py-4 text-sm font-semibold text-paper backdrop-blur-sm transition-colors hover:bg-paper/15"><Compass size={17} /> Explore Mumbai</Link>
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 right-6 hidden items-center gap-3 text-[10px] uppercase tracking-[.2em] text-paper/70 md:flex"><span className="h-px w-10 bg-paper/50" /> Scroll to explore</div>
    </section>

    <section className="relative z-10 -mt-7 md:-mt-10">
      <div className="container"><div className="grid gap-px bg-ink/15 md:grid-cols-3">
        {[{ icon: ShieldCheck, title: "Evidence, not noise", body: "RERA context, source notes, and freshness are visible where they matter." }, { icon: MapPin, title: "Places with a pulse", body: "Understand the streets, commutes, schools, and everyday rhythm around a home." }, { icon: Sparkles, title: "A more thoughtful search", body: "Simple filters first. Intelligent suggestions when they genuinely help." }].map(({ icon: Icon, title, body }) => <div key={title} className="bg-paper p-6 md:p-8"><Icon size={19} className="text-clay" /><h2 className="mt-5 font-display text-xl font-semibold tracking-[-.025em]">{title}</h2><p className="mt-2 text-sm leading-6 text-ink/60">{body}</p></div>)}
      </div></div>
    </section>

    <section className="container py-24 md:py-32">
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="arch-line text-[11px] font-semibold uppercase tracking-[.2em] text-clay">A beginning, not a shortlist</p><h2 className="mt-5 max-w-[580px] font-display text-4xl font-medium leading-[.98] tracking-[-.055em] md:text-6xl">The right place changes the shape of a day.</h2></div><Link href="/buy/mumbai/" className="inline-flex items-center gap-2 text-sm font-semibold text-clay">Browse Mumbai <ArrowUpRight size={16} /></Link></div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">{properties.map((property, index) => <div key={property.id} className={index === 1 ? "md:translate-y-10" : ""}><PropertyCard property={property} /></div>)}</div>
    </section>

    <section className="bg-limestone py-24 md:py-32"><div className="container grid gap-14 md:grid-cols-[.9fr_1.1fr] md:items-start"><div><p className="arch-line text-[11px] font-semibold uppercase tracking-[.2em] text-clay">Choose your starting point</p><h2 className="mt-5 max-w-[420px] font-display text-4xl font-medium leading-[.98] tracking-[-.05em] md:text-5xl">A city is more than a pin on a map.</h2><p className="mt-6 max-w-[390px] text-base leading-7 text-ink/65">Begin with a locality, and we’ll help you understand what living there might feel like.</p></div><div className="grid border-t border-ink/15">{localities.map((locality) => <Link key={locality.name} href="/buy/mumbai/" className="group flex items-center justify-between border-b border-ink/15 py-6 transition-colors hover:text-clay"><div><h3 className="font-display text-2xl font-semibold tracking-[-.03em]">{locality.name}</h3><p className="mt-1 text-sm text-ink/55 group-hover:text-clay/75">{locality.note}</p></div><span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.12em] text-ink/45 group-hover:text-clay">{locality.count} <ArrowUpRight size={17} /></span></Link>)}</div></div></section>

    <section className="bg-ink py-24 text-paper md:py-32"><div className="container grid gap-12 md:grid-cols-[1fr_.75fr] md:items-end"><div><p className="arch-line text-[11px] font-semibold uppercase tracking-[.2em] text-[#f0b59b]">Our point of view</p><h2 className="mt-5 max-w-[700px] font-display text-4xl font-medium leading-[.95] tracking-[-.055em] md:text-6xl">Property search should feel less like a transaction and more like finding your bearings.</h2></div><div className="md:pb-2"><p className="text-base leading-7 text-paper/65">We bring listing detail, locality intelligence, broker context, and source notes into one clear view—so the next step feels considered.</p><Link href="/guide" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#f0b59b]">Read our methodology <ArrowUpRight size={16} /></Link></div></div></section>
  </div>;
}

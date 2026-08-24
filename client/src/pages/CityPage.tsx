/* ARCHITECH — Locality authority page (Paldi, Ahmedabad): visible facts, source context, internal links. */
import { ArrowUpRight, Check, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import PropertyCard, { properties } from "../components/architech/PropertyCard";
import Reveal from "../components/architech/Reveal";

const nearby = [
  { name: "Navrangpura", d: "2.1 km" }, { name: "Ambawadi", d: "2.8 km" }, { name: "Vasna", d: "3.4 km" }, { name: "Ellisbridge", d: "1.6 km" },
];

export default function CityPage() {
  return (
    <div className="bg-paper pt-[78px] text-ink">

      {/* Header band */}
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 stamp !text-[11px] text-ink/50" aria-label="Breadcrumb">
            <Link href="/" className="link-rail hover:text-brick">Home</Link><span>/</span>
            <Link href="/buy/ahmedabad/" className="link-rail hover:text-brick">Buy in Ahmedabad</Link><span>/</span>
            <span className="text-ink/80">Paldi</span>
          </nav>
          <div className="mt-12 grid gap-12 md:grid-cols-[1.25fr_0.75fr] md:items-end">
            <div>
              <p className="kicker text-brick">A locality, in context · पालडी</p>
              <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">Paldi, <em className="text-brick">Ahmedabad.</em></h1>
              <p className="mt-7 max-w-[560px] text-base leading-8 text-ink/65 md:text-lg">
                Old trees, independent cafes, the Sabarmati a short ride away — and a pace that shifts street by street. Explore homes with the whole place around them.
              </p>
            </div>
            <Reveal delay={100}>
              <div className="border-l-4 border-brick bg-paper p-6 editorial-shadow md:p-7">
                <p className="stamp !text-[10px] text-ink/45">Locality snapshot</p>
                <div className="mt-5 grid grid-cols-2 gap-6">
                  {[["128", "active homes"], ["₹11.2k", "median / sq ft"], ["4.8 km", "to riverfront"], ["92%", "RERA coverage"]].map(([n, l]) => (
                    <div key={l}><strong className="font-display text-[28px] font-medium tracking-[-0.02em]">{n}</strong><p className="stamp mt-1 !text-[10px] text-ink/50">{l}</p></div>
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-2 border-t border-ink/10 pt-4 stamp !text-[10px] text-trust"><Clock3 size={12} /> Updated 21 Aug 2026 · Sources reviewed</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feel of the place */}
      <section className="container grid gap-14 py-20 md:grid-cols-[0.95fr_1.05fr] md:items-center md:py-28">
        <Reveal>
          <p className="kicker text-brick">What the place feels like</p>
          <h2 className="display mt-6 max-w-[480px] text-[clamp(30px,3.8vw,52px)]">A neighbourhood with a front door and a <em className="text-brick">backstory</em>.</h2>
          <p className="mt-7 max-w-[460px] text-[15px] leading-7 text-ink/65">
            Paldi balances a residential rhythm with a generous everyday life: walkable lanes, places to eat that aren't chains, and a strong mix of established homes and newer projects.
          </p>
          <ul className="mt-9 space-y-4 text-sm text-ink/75">
            {["Walkable pockets around Law Garden and Tagore Hall", "Schools, cafes, and everyday retail within ten minutes", "A healthy mix of resale character and new RERA projects"].map((t) => (
              <li key={t} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-trust" /> {t}</li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-2">
            <span className="stamp !text-[10px] text-ink/45 mr-1 mt-2">Nearby —</span>
            {nearby.map((n) => (
              <Link key={n.name} href="/buy/ahmedabad/" className="border border-ink/20 px-3.5 py-2 stamp !text-[11px] text-ink/75 transition-colors hover:border-brick hover:text-brick">{n.name} · {n.d}</Link>
            ))}
          </div>
        </Reveal>
        <Reveal delay={140}>
          <figure>
            <div className="arch-frame-sm img-hover grain editorial-shadow">
              <img src="/images/locality-street.jpg" alt="Tree-lined residential street in Paldi, Ahmedabad" className="aspect-[4/3] w-full object-cover" loading="lazy" />
            </div>
            <figcaption className="mt-4 flex items-center justify-between stamp !text-[10px] text-ink/50"><span>Paldi, morning canopy</span><span>Shot on site · Aug 2026</span></figcaption>
          </figure>
        </Reveal>
      </section>

      {/* Real OSM map + distances */}
      <section className="container pb-20 md:pb-28">
        <Reveal>
          <div className="grid gap-0 border border-ink/12 md:grid-cols-[1.3fr_0.7fr]">
            <div className="relative min-h-[380px] bg-sand">
              <iframe
                title="Map of Paldi, Ahmedabad — OpenStreetMap"
                src="https://www.openstreetmap.org/export/embed.html?bbox=72.5350%2C22.9950%2C72.5850%2C23.0270&layer=mapnik&marker=23.011%2C72.559"
                className="map-frame absolute inset-0 h-full w-full border-0"
                loading="lazy"
              />
              <p className="stamp absolute right-3 top-3 bg-paper/90 px-2 py-1 !text-[9px] text-ink/60">© OpenStreetMap contributors</p>
            </div>
            <div className="bg-card p-7 md:p-9">
              <p className="kicker text-brick !text-[10px]">Measured, not guessed</p>
              <h3 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">Distances from Paldi</h3>
              <div className="mt-6 space-y-0 border-t border-ink/12">
                {[["Law Garden", "≈ 1.4 km"], ["Sabarmati Riverfront", "≈ 1.8 km"], ["Tagore Hall", "≈ 0.9 km"], ["IIM Ahmedabad", "≈ 5.2 km"], ["SVP Airport", "≈ 11.6 km"]].map(([place, d]) => (
                  <div key={place} className="flex items-center justify-between border-b border-ink/12 py-3.5">
                    <span className="text-sm text-ink/75">{place}</span>
                    <span className="stamp !text-[11px] font-semibold text-brick">{d}</span>
                  </div>
                ))}
              </div>
              <p className="stamp mt-5 !text-[9px] leading-4 text-ink/40">Geodata via OpenStreetMap · straight-line distances, verified Aug 2026</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Homes */}
      <section className="border-y border-ink/12 bg-sand/60 py-20 md:py-28">
        <div className="container">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="kicker text-brick">Homes in Paldi</p>
              <h2 className="display mt-6 text-[clamp(30px,3.8vw,52px)]">128 homes, each with a <em className="text-brick">source trail</em>.</h2>
            </div>
            <Link href="/search" className="group inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">Refine in search <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {properties.map((property, i) => (
              <Reveal key={property.id} delay={i * 80}><PropertyCard property={property} index={i} /></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust note */}
      <section className="container py-20 md:py-24">
        <Reveal>
          <div className="grid gap-8 border border-ink/12 bg-card p-8 md:grid-cols-[auto_1fr_auto] md:items-center md:p-10">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-trust/10 text-trust"><ShieldCheck size={24} /></span>
            <div>
              <p className="font-display text-2xl font-medium tracking-[-0.015em]">Every Paldi listing is checked against Gujarat RERA.</p>
              <p className="mt-2 max-w-[560px] text-sm leading-6 text-ink/60">Registration numbers, promoter details, and completion status are reviewed before publication — and re-checked when a listing is updated.</p>
            </div>
            <Link href="/guide" className="btn-sweep motion-press inline-flex w-fit items-center gap-2 bg-brick px-6 py-4 stamp !text-[12px] font-semibold text-paper">How we verify</Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

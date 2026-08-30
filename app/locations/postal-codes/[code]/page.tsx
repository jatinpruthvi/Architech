import type { Metadata } from "next";
import Link from "next/link";
import { isValidPincode } from "@/lib/pincodes";
import { resolvePostalCodeForServer } from "@/lib/location/server/postal-resolution";
import { canonicalUrl } from "@/lib/seo/urls";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  if (!isValidPincode(code)) return { title: "Invalid PIN — Architech", robots: { index: false, follow: true } };
  return {
    title: `${code} PIN: post offices and place references — Architech`,
    description: `Inspect sourced post-office, LGD administrative, and reviewed property-locality references for India PIN ${code}.`,
    alternates: { canonical: canonicalUrl(`/locations/postal-codes/${code}/`) },
    // Exact PIN pages remain out of search indexes until their per-record
    // source/quality publication gate is implemented.
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  const resolution = isValidPincode(code) ? await resolvePostalCodeForServer(code) : null;

  return (
    <main className="min-h-[70vh] bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/10 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 stamp-sm" aria-label="Breadcrumb"><Link href="/" className="link-rail">Home</Link><span>/</span><Link href="/locations/" className="link-rail">India locations</Link><span>/</span><span>PIN {code}</span></nav>
          <p className="kicker mt-12 text-brick">Exact six-digit resolution</p>
          <h1 className="display mt-6 text-[clamp(48px,9vw,110px)]">PIN <em className="text-brick">{code}</em></h1>
          <p className="mt-6 max-w-[740px] text-base leading-8 ink-2">A PIN identifies a postal service area, not one guaranteed city, neighbourhood, or boundary. Every category below remains explicit so an administrative or post-office label is never silently sold as a property locality.</p>
        </div>
      </section>

      {!resolution ? <section className="container py-14 md:py-20"><h2 className="font-display text-3xl md:text-5xl">No exact sourced match</h2><p className="mt-5 max-w-[650px] leading-7 ink-2">{isValidPincode(code) ? "This PIN is not present in the currently activated source. Architech will not infer a result from its first digits." : "This is not a valid India PIN. Enter exactly six digits, starting from 1–9."}</p><Link href="/locations/" className="mt-8 inline-block link-rail stamp">Try another PIN →</Link></section> : (
        <>
          <section className="container py-12 md:py-16">
            <div className={`border-l-4 p-5 text-sm leading-7 ${resolution.ambiguous ? "border-brick bg-brick/5" : "border-trust bg-trust/5"}`}><strong>{resolution.ambiguous ? "Multiple or unresolved place meanings." : "One reviewed property-locality interpretation."}</strong> Postal precision remains broader than a rooftop or parcel in either case.</div>
          </section>

          <section className="container grid gap-10 pb-14 lg:grid-cols-2 lg:pb-20">
            <DirectoryBlock title="India Post offices" count={resolution.postOffices.length} empty="No active post-office row is loaded for this PIN.">
              {resolution.postOffices.map((office) => <article key={office.id} className="border-b border-ink/10 py-4 first:pt-0"><h3 className="font-display text-xl">{office.name}</h3><p className="mt-2 text-sm leading-6 ink-2">{[office.officeType, office.deliveryStatus, office.districtName, office.stateName].filter(Boolean).join(" · ")}</p></article>)}
            </DirectoryBlock>
            <DirectoryBlock title="LGD administrative bodies" count={resolution.administrativeAreas.length} empty="No active LGD local-body association is loaded for this PIN.">
              {resolution.administrativeAreas.map((area) => <article key={area.id} className="border-b border-ink/10 py-4 first:pt-0"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-xl">{area.name}</h3><span className="font-mono text-xs ink-3">LGD {area.lgdCode ?? "—"}</span></div><p className="mt-2 text-sm leading-6 ink-2">{[area.subtype ?? area.type, area.state?.name].filter(Boolean).join(" · ")}</p></article>)}
            </DirectoryBlock>
            <DirectoryBlock title="Reviewed property localities" count={resolution.localities.length} empty="No reviewed Architech property locality is linked to this PIN.">
              {resolution.localities.map((locality) => <article key={`${locality.citySlug}-${locality.slug}`} className="border-b border-ink/10 py-4 first:pt-0"><Link href={`/locality/${locality.citySlug}/${locality.slug}/`} className="font-display text-xl link-rail">{locality.name}</Link><p className="mt-2 text-sm ink-2">{locality.cityName} · {locality.linkType.toLowerCase().replaceAll("_", " ")}{locality.confidence === null ? "" : ` · ${Math.round(locality.confidence * 100)}% evidence confidence`}</p></article>)}
            </DirectoryBlock>
            <DirectoryBlock title="Cities with reviewed links" count={resolution.cities.length} empty="No product city has been linked from reviewed locality evidence.">
              {resolution.cities.map((city) => <article key={city.slug} className="border-b border-ink/10 py-4 first:pt-0"><Link href={`/buy/${city.slug}/`} className="font-display text-xl link-rail">{city.name}</Link><p className="mt-2 text-sm ink-2">{city.state}</p></article>)}
            </DirectoryBlock>
          </section>

          <section className="border-t border-ink/10 bg-sand/45">
            <div className="container py-12 md:py-16"><p className="kicker text-brick">Source trail</p><h2 className="font-display mt-4 text-3xl md:text-5xl">Evidence behind this result</h2><div className="mt-8 grid gap-4 lg:grid-cols-3">{resolution.sources.map((source) => <article key={source.key} className="border border-ink/15 bg-paper p-5"><h3 className="font-display text-xl">{source.name}</h3><p className="mt-2 text-sm ink-2">{source.publisher}</p><p className="mt-4 stamp-sm ink-3">Retrieved {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(source.retrievedAt))}</p><a className="mt-5 inline-block link-rail stamp-sm" href={source.sourceUrl} rel="noreferrer" target="_blank">Official/source record</a></article>)}</div></div>
          </section>
        </>
      )}
    </main>
  );
}

function DirectoryBlock({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return <section><div className="flex items-baseline justify-between gap-4 border-b border-ink/20 pb-4"><h2 className="font-display text-2xl md:text-3xl">{title}</h2><span className="stamp-sm ink-3">{count}</span></div><div className="pt-5">{count ? children : <p className="text-sm leading-7 ink-2">{empty}</p>}</div></section>;
}

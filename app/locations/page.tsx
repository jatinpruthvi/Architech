import type { Metadata } from "next";
import Link from "next/link";
import { getIndiaLocationCoverageForServer } from "@/lib/location/server/coverage";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "India location and PIN directory — Architech",
  description: "Browse Architech’s sourced India location registry, exact PIN coverage, India Post offices, and LGD local bodies without conflating administrative, postal, and property localities.",
  alternates: { canonical: canonicalUrl("/locations/") },
  openGraph: { title: "India location and PIN directory — Architech", url: canonicalUrl("/locations/"), type: "website" },
};

const number = new Intl.NumberFormat("en-IN");
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function Page() {
  const coverage = await getIndiaLocationCoverageForServer();
  const ready = coverage.status === "ready";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Architech India location coverage directory",
    description: coverage.disclaimer,
    url: canonicalUrl("/locations/"),
    creator: { "@type": "Organization", name: "Architech", url: homeUrl() },
    spatialCoverage: { "@type": "Country", name: "India" },
    isAccessibleForFree: true,
    license: coverage.sources.postalDirectory?.licenseUrl ?? coverage.sources.stateRegistry?.licenseUrl ?? undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="bg-paper pt-[78px] text-ink">
        <section className="border-b border-ink/10 bg-sand/70 py-14 md:py-20">
          <div className="container">
            <nav className="flex items-center gap-2 stamp-sm" aria-label="Breadcrumb"><Link href="/" className="link-rail">Home</Link><span>/</span><span>India location directory</span></nav>
            <div className="mt-12 flex flex-wrap items-center gap-3">
              <p className="kicker text-brick">Official-reference coverage</p>
              <span className={`border px-2.5 py-1 stamp-sm ${ready ? "border-trust/30 text-trust" : "border-brick/30 text-brick"}`}>
                {ready ? "National snapshot active" : "Activation gates not met"}
              </span>
            </div>
            <h1 className="display mt-6 max-w-[980px] text-[clamp(42px,7vw,92px)]">India, one sourced <em className="text-brick">place at a time.</em></h1>
            <p className="mt-7 max-w-[760px] text-base leading-8 ink-2 md:text-lg">
              Search an exact six-digit PIN or inspect all 36 States and Union Territories. Postal offices, LGD administrative bodies, Architech property localities, and map geometry stay separate—because sharing a name does not make them the same place.
            </p>
            <form action="/locations/postal-codes" method="get" className="mt-9 flex max-w-[560px] flex-col gap-3 sm:flex-row" role="search">
              <label htmlFor="pin-code" className="sr-only">Six-digit PIN code</label>
              <input id="pin-code" name="code" inputMode="numeric" pattern="[1-9][0-9]{5}" minLength={6} maxLength={6} required placeholder="Enter a six-digit PIN" className="min-h-12 flex-1 border border-ink/25 bg-paper px-4 text-base outline-none transition focus:border-brick focus:ring-2 focus:ring-brick/20" />
              <button type="submit" className="min-h-12 bg-ink px-6 stamp text-paper transition hover:bg-brick">Resolve PIN</button>
            </form>
          </div>
        </section>

        <section className="container py-12 md:py-16" aria-labelledby="coverage-heading">
          <div className="grid gap-px border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["States + UTs", coverage.totals.stateOrUtCount],
              ["Active PINs", coverage.totals.postalCodeCount],
              ["India Post offices", coverage.totals.postOfficeCount],
              ["LGD local bodies", coverage.totals.localBodyCount],
            ].map(([label, value]) => <div key={label} className="bg-paper p-6"><p className="font-display text-3xl">{number.format(Number(value))}</p><p className="mt-2 stamp-sm ink-3">{label}</p></div>)}
          </div>
          <div className={`mt-6 border-l-4 p-5 text-sm leading-7 ${ready ? "border-trust bg-trust/5" : "border-brick bg-brick/5"}`}>
            {ready
              ? "All national activation gates currently pass. These totals describe official reference coverage in the database, not the number of cities with active property inventory."
              : coverage.mode === "reference-only"
                ? "The official 36-jurisdiction reference registry is available, but the nationwide India Post and LGD bulk snapshots have not been activated in this environment. National postal coverage is not being claimed."
                : "The database contains location records, but one or more completeness or freshness gates fail. Architech does not present this partial import as nationwide coverage."}
          </div>
        </section>

        <section className="container pb-14 md:pb-20" aria-labelledby="coverage-heading">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-5">
            <div><p className="kicker text-brick">Administrative directory</p><h2 id="coverage-heading" className="font-display mt-3 text-3xl md:text-5xl">States and Union Territories</h2></div>
            <p className="max-w-[450px] text-sm leading-6 ink-2">Post-office and local-body counts are database evidence. A zero means not loaded, not that the jurisdiction has none.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <caption className="sr-only">India location reference coverage by State and Union Territory</caption>
              <thead><tr className="border-b border-ink/20 stamp ink-3"><th className="py-3 pr-4 font-medium">Jurisdiction</th><th className="py-3 pr-4 font-medium">LGD code</th><th className="py-3 pr-4 font-medium">India Post offices</th><th className="py-3 pr-4 font-medium">LGD local bodies</th><th className="py-3 font-medium">Reference type</th></tr></thead>
              <tbody>{coverage.states.map((state) => <tr key={state.lgdCode} className="border-b border-ink/10"><th scope="row" className="py-4 pr-4 text-left font-normal"><Link href={`/locations/${state.slug}/`} className="link-rail">{state.name}</Link></th><td className="py-4 pr-4 font-mono text-sm">{state.lgdCode}</td><td className="py-4 pr-4">{number.format(state.postalOfficeCount)}</td><td className="py-4 pr-4">{number.format(state.localBodyCount)}</td><td className="py-4 stamp-sm ink-3">{state.kind === "STATE" ? "State" : "Union Territory"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="border-y border-ink/10 bg-sand/45">
          <div className="container grid gap-10 py-14 lg:grid-cols-[1fr_1.3fr] lg:py-20">
            <div><p className="kicker text-brick">Provenance, not promises</p><h2 className="font-display mt-4 text-3xl md:text-5xl">What these records mean</h2></div>
            <div className="grid gap-5 text-sm leading-7 ink-2 sm:grid-cols-2">
              <p><strong className="text-ink">PIN and post office:</strong> Department of Posts routing references. A PIN can cover several offices and places; it is not a neighbourhood boundary.</p>
              <p><strong className="text-ink">LGD local body:</strong> An official administrative identifier and sourced PIN association. It is not automatically an Architech search locality.</p>
              <p><strong className="text-ink">Property locality:</strong> A reviewed product concept linked separately to one or more PINs and administrative areas.</p>
              <p><strong className="text-ink">Property inventory:</strong> Coverage on <Link href="/buy/" className="link-rail">Buy</Link> depends on active, reviewed listings and remains distinct from this nationwide reference registry.</p>
            </div>
          </div>
        </section>

        <section className="container py-14 md:py-20">
          <p className="kicker text-brick">Sources and reuse</p>
          <h2 className="font-display mt-4 text-3xl md:text-5xl">Freshness trail</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {Object.values(coverage.sources).filter((source): source is NonNullable<typeof source> => Boolean(source)).map((source) => (
              <article key={source.key} className="border border-ink/15 p-5">
                <h3 className="font-display text-xl">{source.name}</h3><p className="mt-2 text-sm ink-2">{source.publisher}</p>
                <dl className="mt-5 grid gap-2 text-sm"><div><dt className="inline stamp-sm ink-3">Retrieved </dt><dd className="inline">{date.format(new Date(source.retrievedAt))}</dd></div><div><dt className="inline stamp-sm ink-3">Version </dt><dd className="inline">{source.version ?? "Source did not publish one"}</dd></div></dl>
                <div className="mt-5 flex flex-wrap gap-4 stamp-sm"><a href={source.sourceUrl} rel="noreferrer" target="_blank" className="link-rail">Official source</a>{source.licenseUrl ? <a href={source.licenseUrl} rel="noreferrer" target="_blank" className="link-rail">{source.licenseName ?? "Licence"}</a> : null}</div>
              </article>
            ))}
          </div>
          <p className="mt-7 max-w-[780px] text-sm leading-7 ink-2">{coverage.disclaimer}</p>
        </section>
      </main>
    </>
  );
}

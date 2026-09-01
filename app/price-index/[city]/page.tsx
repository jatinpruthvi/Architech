import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compactInr, formatPsf } from "@/lib/realestate/locality-intel";
import { cityMarketTrends } from "@/lib/realestate/market-trends";
import { allCityMarketTrends, priceIndexJsonLd, priceIndexMetadata, priceIndexOutboundLinks } from "@/lib/seo/price-index";
import { cityAcquisitionPlan } from "@/lib/seo/acquisition-queue";
import { cityPriceIndexUrl, localityUrl, priceIndexUrl } from "@/lib/seo/urls";
import { getCityStaticParams, getLiveCityBySlug } from "@/lib/repositories";
import NotesList from "@/components/architech/NotesList";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export function generateStaticParams() {
  return getCityStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!getLiveCityBySlug(city)) return { title: "Not found" };
  return priceIndexMetadata(cityMarketTrends(city));
}

/* One city's property price index.

   The page prints what the report publishes and shows what it withholds.
   When a city is below the minimum sample there are no figures to show, so
   the page says so and is noindexed rather than shipped as a near-empty
   page — E §6's "delete thin content", applied before publication instead
   of after.

   The locality rows are a table on this page, not pages of their own. Each
   locality already has a page under /buy/{city}/{locality}/ carrying its own
   intel; splitting the index by locality would duplicate it and halve the
   signal, which is the doorway-page failure E warns about in §7. */
export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  if (!getLiveCityBySlug(citySlug)) notFound();

  const report = cityMarketTrends(citySlug);
  const jsonLd = priceIndexJsonLd(report);
  const links = priceIndexOutboundLinks(report);
  const siblings = allCityMarketTrends().filter((entry) => entry.citySlug !== citySlug);
  const plan = cityAcquisitionPlan(citySlug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="bg-paper pt-[78px] text-ink">
        <section className="border-b border-ink/10 bg-sand/70 py-14 md:py-20">
          <div className="container">
            <nav className="flex flex-wrap items-center gap-2 stamp-sm" aria-label="Breadcrumb">
              <Link href="/" className="link-rail">Home</Link><span>/</span>
              <Link href={priceIndexUrl()} className="link-rail">Price index</Link><span>/</span>
              <span>{report.cityName}</span>
            </nav>
            <p className="kicker mt-12 text-brick">
              As of {report.asOfLabel} · {report.citySampleSize} sale listings
            </p>
            <h1 className="display mt-6 text-[clamp(40px,6vw,84px)]">{report.cityName} <em className="text-brick">price index.</em></h1>
            <p className="mt-7 max-w-[620px] text-base leading-8 ink-2 md:text-lg">
              {report.publishable
                ? `Median asking price, rate per square foot, and median asking rent across ${report.cityName}, with a per-locality breakdown against the city's own average.`
                : `The ${report.cityName} index is not published yet. The sample is below the minimum we require before printing a figure, and the blockers are listed below.`}
            </p>
          </div>
        </section>

        {!report.publishable ? (
          <section className="container py-12">
            <div className="border-l-4 border-brick bg-sand/50 p-6">
              <p className="stamp text-brick">Not published</p>
              <NotesList title="Why this city is withheld" items={report.blockers} tone="alert" />
              {/* The blocker says what is missing; this says exactly how much.
                  The gates are arithmetic, so the distance to publishing is
                  knowable in advance — and publishing it is the honest
                  counterpart to publishing the gap. Someone reading a withheld
                  index should be told what would unwithhold it. */}
              {plan.minimumToPublish.gap > 0 ? (
                <p className="mt-5 border-t border-ink/20 pt-4 text-sm leading-7 ink-2">
                  This index publishes when any one locality reaches {report.minSample} sale listings.{" "}
                  <strong className="font-semibold">
                    {plan.minimumToPublish.localities.join(" / ")} is closest, {plan.minimumToPublish.gap} short.
                  </strong>
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="container grid gap-6 border border-ink/20 bg-paper p-6 md:grid-cols-4">
            <div className="border-l-4 border-brick pl-4 md:border-l-0 md:border-r md:border-ink/10 md:pl-0">
              <p className="stamp ink-3">Median price</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">{compactInr(report.cityMedianPriceInr)}</p>
            </div>
            <div className="border-l-4 border-brick pl-4">
              <p className="stamp ink-3">Avg / sq ft</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">{formatPsf(report.cityAvgPricePerSqftInr)}</p>
            </div>
            <div className="border-l-4 border-brick pl-4">
              <p className="stamp ink-3">Median rent</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">
                {report.cityMedianMonthlyRentInr === null ? "—" : `${compactInr(report.cityMedianMonthlyRentInr)}/mo`}
              </p>
            </div>
            <div className="border-l-4 border-brick pl-4">
              <p className="stamp ink-3">Localities publishing</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">{report.coverage.published}/{report.coverage.total}</p>
            </div>
          </section>
        )}

        <section className="container py-14">
          <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">By locality</h2>
          <p className="mt-2 max-w-[620px] text-sm leading-7 ink-2">
            Each locality is compared against this city&apos;s own average rate per square foot. A row with no
            figures has too small a sample to publish and is shown with its count so the gap is visible.
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <caption className="sr-only">{report.cityName} property price index by locality</caption>
              <thead>
                <tr className="border-b border-ink/20 stamp ink-3">
                  <th scope="col" className="py-3 pr-4 font-medium">Locality</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Median</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Avg / sq ft</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Median rent</th>
                  <th scope="col" className="py-3 pr-4 font-medium">vs city</th>
                  <th scope="col" className="py-3 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {report.localities.map((row) => (
                  <tr key={row.slug} className="border-b border-ink/10">
                    <th scope="row" className="py-4 pr-4 text-left font-normal">
                      <Link href={localityUrl(report.citySlug, row.slug)} className="link-rail">{row.name}</Link>
                    </th>
                    <td className="py-4 pr-4 font-display text-lg">{row.published ? compactInr(row.medianPriceInr) : "—"}</td>
                    <td className="py-4 pr-4">{row.published ? formatPsf(row.avgPricePerSqftInr) : "—"}</td>
                    <td className="py-4 pr-4">{row.medianMonthlyRentInr === null ? "—" : `${compactInr(row.medianMonthlyRentInr)}/mo`}</td>
                    <td className="py-4 pr-4">
                      {row.deltaPct === null ? "—" : (
                        <span className={row.deltaPct > 0 ? "text-brick" : "text-trust"}>
                          {row.deltaPct > 0 ? "+" : ""}{row.deltaPct}%
                        </span>
                      )}
                    </td>
                    <td className="py-4 ink-2">{row.saleSampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="stamp mt-3 ink-3">
            {report.coverage.published} published · {report.coverage.withheld} withheld · {report.coverage.empty} with no sale listing · minimum sample {report.minSample}
          </p>
        </section>

        <section className="container grid gap-12 pb-16 md:grid-cols-2">
          <NotesList title="Methodology" items={report.methodology} />
          <NotesList title="Limitations" items={report.limitations} />
        </section>

        <section className="container pb-16">
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="stamp mr-1 mt-2 ink-3">In this city</span>
            <Link href={links.parent} className="border border-ink/20 px-3.5 py-2 stamp-sm transition-colors hover:border-brick hover:text-brick">
              Homes in {report.cityName}
            </Link>
            {links.localities.map((locality) => (
              <Link key={locality.url} href={locality.url} className="border border-ink/20 px-3.5 py-2 stamp-sm transition-colors hover:border-brick hover:text-brick">
                {locality.name}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="stamp mr-1 mt-2 ink-3">Other cities</span>
            {siblings.map((entry) => (
              <Link key={entry.citySlug} href={cityPriceIndexUrl(entry.citySlug)} className="border border-ink/20 px-3.5 py-2 stamp-sm transition-colors hover:border-brick hover:text-brick">
                {entry.cityName}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

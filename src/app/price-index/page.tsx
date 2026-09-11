import type { Metadata } from "next";
import Link from "next/link";
import { compactInr, formatPsf } from "@/lib/realestate/locality-intel";
import { priceIndexHubJsonLd, priceIndexHubMetadata, allCityMarketTrends } from "@/lib/seo/price-index";
import { cityPriceIndexUrl } from "@/lib/seo/urls";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const metadata: Metadata = priceIndexHubMetadata();

/* The city property price index (StudyArena round-12, contestant E §5).

   E's argument is that a published, method-stated price index is the one
   authority lever that cannot be faked: journalists cite numbers, and a
   citation is a link. The report behind this page already existed and was
   already gated — it simply was not reachable, because the only way to read
   it was a JSON API route.

   The hub lists every city, including the ones whose sample is too small to
   publish. Leaving them out would make the coverage look better than it is;
   showing the gap is what makes the published cities believable. */
export default function Page() {
  const reports = allCityMarketTrends();
  const jsonLd = priceIndexHubJsonLd(reports);
  const published = reports.filter((report) => report.publishable);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="bg-paper pt-[78px] text-ink">
        <section className="border-b border-ink/10 bg-sand/70 py-14 md:py-20">
          <div className="container">
            <nav className="flex flex-wrap items-center gap-2 stamp-sm" aria-label="Breadcrumb">
              <Link href="/" className="link-rail">Home</Link><span>/</span>
              <span>Property price index</span>
            </nav>
            <p className="kicker mt-12 text-brick">The number, and what it is made of</p>
            <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">Property <em className="text-brick">price index.</em></h1>
            <p className="mt-7 max-w-[620px] text-base leading-8 ink-2 md:text-lg">
              Median asking price and rate per square foot for every city Architech covers, per locality, from
              the inventory we have published. Every figure carries its sample size and the minimum sample we
              require before printing one — because a number you cannot interrogate is not worth citing.
            </p>
            <p className="stamp mt-6 ink-3">
              {published.length} of {reports.length} cities currently clear the bar. The rest are listed with the
              reason they do not.
            </p>
          </div>
        </section>

        <section className="container py-14 md:py-20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">Property price index by city, with publication status</caption>
              <thead>
                <tr className="border-b border-ink/20 stamp ink-3">
                  <th scope="col" className="py-3 pr-4 font-medium">City</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Median</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Avg / sq ft</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Median rent</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Localities</th>
                  <th scope="col" className="py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.citySlug} className="border-b border-ink/10">
                    <th scope="row" className="py-4 pr-4 text-left font-normal">
                      <Link href={cityPriceIndexUrl(report.citySlug)} className="link-rail">
                        {report.cityName}
                      </Link>
                    </th>
                    <td className="py-4 pr-4 font-display text-lg">{report.cityPublished ? compactInr(report.cityMedianPriceInr) : "—"}</td>
                    <td className="py-4 pr-4">{report.cityPublished ? formatPsf(report.cityAvgPricePerSqftInr) : "—"}</td>
                    <td className="py-4 pr-4">{report.cityMedianMonthlyRentInr === null ? "—" : `${compactInr(report.cityMedianMonthlyRentInr)}/mo`}</td>
                    <td className="py-4 pr-4 ink-2">{report.coverage.published}/{report.coverage.total}</td>
                    <td className="py-4">
                      {report.publishable ? (
                        <span className="stamp text-trust">Published</span>
                      ) : (
                        <span className="stamp ink-3">Withheld — thin sample</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 max-w-[620px] text-sm leading-7 ink-2">
            Figures are asking prices from published inventory, not transacted prices, and the sample is small.
            Each city report states its methodology, its minimum sample, and exactly what is being withheld.
          </p>

          <div className="mt-10 flex flex-wrap gap-2">
            <span className="stamp mr-1 mt-2 ink-3">Browse homes</span>
            <Link href="/buy/" className="border border-ink/20 px-3.5 py-2 stamp-sm transition-colors hover:border-brick hover:text-brick">
              All cities
            </Link>
            <Link href="/guide" className="border border-ink/20 px-3.5 py-2 stamp-sm transition-colors hover:border-brick hover:text-brick">
              How we verify
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

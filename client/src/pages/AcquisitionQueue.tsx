"use client";
/* The acquisition queue — what to source next, and what it publishes.

   This is the operational half of the SEO work and the reason it belongs in
   the admin surface rather than in a report: every number here is a threshold
   the site already enforces, so the distance to each one is arithmetic and
   what flips when it closes is knowable in advance.

   The asymmetry is the whole point. A listing page can at best rank for its
   own entity — a handful of searches a month. The same two listings, placed
   in the right locality, publish an entire city's price index, put figures on
   every locality page in it, and add a page that earns links. Only the second
   is knowable before you spend anything, so this is where sourcing decisions
   should come from.

   Nothing here promises a ranking. It answers a question ranking reports
   cannot: what is the next listing worth? */
import { ArrowRight, CircleDashed, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useTitle from "@/hooks/useTitle";

type LocalityAsk = {
  localitySlug: string;
  localityName: string;
  saleSampleSize: number;
  rentSampleSize: number;
  saleGap: number;
  rentGap: number;
  publishesPrice: boolean;
  publishesRent: boolean;
  programmaticGap: number;
};

type CityPlan = {
  citySlug: string;
  cityName: string;
  publishable: boolean;
  blockers: string[];
  localitiesPublishing: number;
  localitiesTotal: number;
  minimumToPublish: { gap: number; localities: string[] };
  fullCoverage: { gap: number; localities: string[] };
  localities: LocalityAsk[];
};

type Headline = { action: string; listings: number; unlocks: string[] } | null;

type Payload = {
  ok: boolean;
  headline: Headline;
  plans: CityPlan[];
  totals: {
    cities: number;
    withheldIndexes: number;
    listingsToPublishEveryIndex: number;
    listingsToFullCoverage: number;
  };
};

export default function AcquisitionQueue() {
  useTitle("Acquisition queue");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/acquisition", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        setError(body?.errors?.[0] ?? "The acquisition queue could not be loaded.");
        return;
      }
      setPayload(body as Payload);
    } catch {
      setError("The acquisition queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="container py-24 stamp ink-3">Reading the publication gates…</p>;
  if (error || !payload) {
    return (
      <div className="container py-24">
        <p className="stamp text-brick">Unavailable</p>
        <p className="mt-3 max-w-lg text-sm leading-7 ink-2">{error}</p>
      </div>
    );
  }

  const { headline, plans, totals } = payload;
  const withheld = plans.filter((plan) => !plan.publishable);

  return (
    <div className="container py-14 md:py-20">
      <p className="kicker text-brick">Inventory × publication gates</p>
      <h1 className="display mt-6 text-[clamp(34px,5vw,64px)]">What to source <em className="text-brick">next.</em></h1>
      <p className="mt-6 max-w-[640px] text-[15px] leading-7 ink-2">
        Every threshold below is one the site already enforces, so the distance to it is arithmetic and what
        publishes when it closes is known in advance. This is not a ranking report — it is the answer to a
        question ranking reports cannot answer: what is the next listing worth?
      </p>

      {headline ? (
        <section className="mt-12 border-l-4 border-brick bg-sand/50 p-7">
          <p className="stamp flex items-center gap-2 text-brick"><Target size={15} /> Cheapest unlock on the site</p>
          <p className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">{headline.action}</p>
          <p className="mt-4 text-sm leading-7 ink-2">Publishes:</p>
          <ul role="list" className="mt-2 space-y-1 text-sm leading-7 ink-2">
            {headline.unlocks.map((unlock) => (
              <li key={unlock} className="flex gap-2"><ArrowRight size={15} className="mt-1 shrink-0 text-brick" />{unlock}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-12 border-l-4 border-trust bg-sand/50 p-7">
          <p className="stamp text-trust">Nothing is gated</p>
          <p className="mt-3 text-sm leading-7 ink-2">
            Every city index publishes and every locality prints its figures. The next constraint is demand, not
            inventory.
          </p>
        </section>
      )}

      <section className="mt-12 grid gap-5 md:grid-cols-4">
        {[
          ["Cities", String(totals.cities)],
          ["Indexes withheld", String(totals.withheldIndexes)],
          ["To publish every index", String(totals.listingsToPublishEveryIndex)],
          ["To full coverage", String(totals.listingsToFullCoverage)],
        ].map(([label, value]) => (
          <div key={label} className="border-t-2 border-brick pt-4">
            <p className="stamp ink-3">{label}</p>
            <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em]">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">By city</h2>
        <p className="mt-2 max-w-[640px] text-sm leading-7 ink-2">
          Sorted cheapest first. &ldquo;Minimum&rdquo; is the smallest ask that publishes the city index — one
          locality clearing the bar is enough, which is why it is so much smaller than full coverage.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/20 stamp ink-3">
                <th scope="col" className="py-3 pr-4 font-medium">City</th>
                <th scope="col" className="py-3 pr-4 font-medium">Index</th>
                <th scope="col" className="py-3 pr-4 font-medium">Localities</th>
                <th scope="col" className="py-3 pr-4 font-medium">Minimum</th>
                <th scope="col" className="py-3 font-medium">Full coverage</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.citySlug} className="border-b border-ink/10">
                  <th scope="row" className="py-4 pr-4 text-left font-normal">
                    <Link href={`/price-index/${plan.citySlug}/`} className="link-rail">{plan.cityName}</Link>
                  </th>
                  <td className="py-4 pr-4">
                    {plan.publishable ? (
                      <span className="stamp text-trust">Published</span>
                    ) : (
                      <span className="stamp text-brick">Withheld</span>
                    )}
                  </td>
                  <td className="py-4 pr-4 ink-2">{plan.localitiesPublishing}/{plan.localitiesTotal}</td>
                  <td className="py-4 pr-4">
                    {plan.minimumToPublish.gap === 0 ? "—" : `${plan.minimumToPublish.gap} in ${plan.minimumToPublish.localities.join(" / ")}`}
                  </td>
                  <td className="py-4 ink-2">{plan.fullCoverage.gap === 0 ? "—" : String(plan.fullCoverage.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {withheld.length > 0 ? (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">Localities behind a withheld index</h2>
          <p className="mt-2 max-w-[640px] text-sm leading-7 ink-2">
            Sale listings are what publish a median and a rate per square foot. Rentals publish a median rent
            only — they are counted separately and never mixed, which is why they are a different column.
          </p>
          {withheld.map((plan) => (
            <div key={plan.citySlug} className="mt-8">
              <p className="stamp flex items-center gap-2 text-brick"><TrendingUp size={15} /> {plan.cityName}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-ink/20 stamp ink-3">
                      <th scope="col" className="py-3 pr-4 font-medium">Locality</th>
                      <th scope="col" className="py-3 pr-4 font-medium">Sale now</th>
                      <th scope="col" className="py-3 pr-4 font-medium">Needs</th>
                      <th scope="col" className="py-3 pr-4 font-medium">Rent now</th>
                      <th scope="col" className="py-3 font-medium">Needs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.localities.map((ask) => (
                      <tr key={ask.localitySlug} className="border-b border-ink/10">
                        <th scope="row" className="py-3 pr-4 text-left font-normal">{ask.localityName}</th>
                        <td className="py-3 pr-4 ink-2">{ask.saleSampleSize}</td>
                        <td className="py-3 pr-4">
                          {ask.saleGap === 0 ? (
                            <span className="stamp text-trust">Publishes</span>
                          ) : (
                            <span className="font-semibold">+{ask.saleGap}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 ink-2">{ask.rentSampleSize}</td>
                        <td className="py-3">{ask.rentGap === 0 ? "—" : `+${ask.rentGap}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mt-14 border-t border-ink/10 pt-8">
        <p className="stamp flex items-center gap-2 ink-3"><CircleDashed size={15} /> Where the numbers come from</p>
        <p className="mt-3 max-w-[640px] text-sm leading-7 ink-2">
          Three sale listings publish a locality median and rate per square foot. One locality clearing that bar
          publishes the whole city index. Six live listings is the evidence bar for any generated page on a
          locality. These are the same gates the price index and the sitemap already apply — this page only
          measures the distance to them.
        </p>
      </section>
    </div>
  );
}

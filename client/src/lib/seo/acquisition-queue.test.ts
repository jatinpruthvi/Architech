/* The acquisition queue contract.

   The promise this module makes is arithmetic, not editorial: it names a
   number of listings in a named place and says what will publish when they
   arrive. That is only trustworthy if the arithmetic is right, so these tests
   hold it to the gates rather than to today's fixtures.

   The invariant that matters most is the counterfactual in "closes the gap
   exactly". A queue that under-reports by one would send a broker to source
   two listings, watch nothing publish, and stop trusting the tool — which is
   worse than having no tool. So every gap is asserted to be exactly what is
   missing, and never more.

   The second thing pinned here is the asymmetry. To publish a city index only
   ONE locality must clear the bar, so the minimum ask must be the cheapest
   single locality, never the sum of every gap in the city. Reporting the sum
   would overstate the cheapest win in the country by sevenfold and bury it. */
import { describe, expect, it } from "vitest";
import { getCities, getLocalities } from "@/lib/repositories";
import { cityMarketTrends } from "@/lib/realestate/market-trends";
import { localityPriceTrends, MIN_SAMPLE_FOR_PUBLISHED_STAT } from "@/lib/realestate/price-trends";
import {
  PROGRAMMATIC_BAR_LISTINGS,
  acquisitionHeadline,
  acquisitionQueue,
  cityAcquisitionPlan,
} from "./acquisition-queue";

const plans = acquisitionQueue();
const withheld = plans.filter((plan) => !plan.publishable);

describe("acquisition queue", () => {
  it("covers every city", () => {
    expect(plans.length).toBe(getCities().length);
  });

  it("ranks a withheld city above one that already publishes", () => {
    const firstComplete = plans.findIndex((plan) => plan.publishable);
    if (firstComplete === -1) return;
    for (const plan of plans.slice(firstComplete)) expect(plan.publishable).toBe(true);
  });

  it("orders withheld cities by the cost of the cheapest unlock", () => {
    for (let i = 1; i < withheld.length; i += 1) {
      expect(withheld[i]!.minimumToPublish.gap).toBeGreaterThanOrEqual(withheld[i - 1]!.minimumToPublish.gap);
    }
  });
});

describe("each gap is exactly what is missing", () => {
  it("closes the price bar precisely, never short", () => {
    for (const plan of plans) {
      for (const ask of plan.localities) {
        const trends = localityPriceTrends(ask.localitySlug, plan.citySlug);
        /* The counterfactual the whole tool rests on: add `saleGap` listings
           and the sample reaches the bar — not one fewer, not one more. */
        expect(ask.saleSampleSize + ask.saleGap, `${plan.citySlug}/${ask.localitySlug}`).toBe(
          Math.max(MIN_SAMPLE_FOR_PUBLISHED_STAT, ask.saleSampleSize),
        );
        expect(ask.saleGap, `${plan.citySlug}/${ask.localitySlug}`).toBe(
          Math.max(0, MIN_SAMPLE_FOR_PUBLISHED_STAT - trends.saleSampleSize),
        );
        expect(ask.rentGap, `${plan.citySlug}/${ask.localitySlug}`).toBe(
          Math.max(0, MIN_SAMPLE_FOR_PUBLISHED_STAT - trends.rentSampleSize),
        );
      }
    }
  });

  it("reports no gap where figures already publish, and never a negative one", () => {
    for (const plan of plans) {
      for (const ask of plan.localities) {
        if (ask.publishesPrice) expect(ask.saleGap, ask.localitySlug).toBe(0);
        if (ask.publishesRent) expect(ask.rentGap, ask.localitySlug).toBe(0);
        expect(ask.saleGap).toBeGreaterThanOrEqual(0);
        expect(ask.rentGap).toBeGreaterThanOrEqual(0);
        expect(ask.programmaticGap).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("counts every live listing toward the programmatic bar, not just sales", () => {
    for (const plan of plans) {
      for (const ask of plan.localities) {
        const trends = localityPriceTrends(ask.localitySlug, plan.citySlug);
        expect(ask.programmaticGap, ask.localitySlug).toBe(Math.max(0, PROGRAMMATIC_BAR_LISTINGS - trends.count));
      }
    }
  });
});

/* The asymmetry that makes the tool worth having. */
describe("the cheapest unlock is not the sum of every gap", () => {
  it("asks only for the locality closest to the bar", () => {
    for (const plan of withheld) {
      const cheapest = Math.min(...plan.localities.map((ask) => ask.saleGap).filter((gap) => gap > 0), Infinity);
      expect(plan.minimumToPublish.gap, plan.citySlug).toBe(Number.isFinite(cheapest) ? cheapest : 0);
      expect(plan.minimumToPublish.localities.length, plan.citySlug).toBeLessThanOrEqual(1);
    }
  });

  it("never asks for more than full coverage", () => {
    for (const plan of plans) {
      expect(plan.minimumToPublish.gap, plan.citySlug).toBeLessThanOrEqual(plan.fullCoverage.gap);
    }
  });

  it("asks for nothing when the index already publishes", () => {
    for (const plan of plans.filter((entry) => entry.publishable)) {
      expect(plan.minimumToPublish.gap, plan.citySlug).toBe(0);
      expect(plan.minimumToPublish.localities, plan.citySlug).toEqual([]);
    }
  });

  it("names only localities that are actually short", () => {
    for (const plan of plans) {
      const short = new Set(plan.localities.filter((ask) => ask.saleGap > 0).map((ask) => ask.localityName));
      for (const name of plan.fullCoverage.localities) expect(short, plan.citySlug).toContain(name);
    }
  });
});

describe("it agrees with the gates it reports on", () => {
  it("matches cityMarketTrends on publishability and coverage", () => {
    for (const plan of plans) {
      const report = cityMarketTrends(plan.citySlug);
      expect(plan.publishable, plan.citySlug).toBe(report.publishable);
      expect(plan.localitiesPublishing, plan.citySlug).toBe(report.coverage.published);
      expect(plan.localitiesTotal, plan.citySlug).toBe(report.coverage.total);
      expect(plan.blockers, plan.citySlug).toEqual(report.blockers);
    }
  });

  it("covers every locality in each city", () => {
    for (const plan of plans) {
      expect(plan.localities.length, plan.citySlug).toBe(getLocalities(plan.citySlug).length);
      expect(plan.localitiesTotal, plan.citySlug).toBe(plan.localities.length);
    }
  });

  it("is the same plan however it is reached", () => {
    for (const city of getCities()) {
      expect(cityAcquisitionPlan(city.slug).minimumToPublish).toEqual(
        plans.find((plan) => plan.citySlug === city.slug)!.minimumToPublish,
      );
    }
  });
});

describe("the headline", () => {
  it("names the cheapest action that publishes a page", () => {
    const headline = acquisitionHeadline();
    if (withheld.length === 0) {
      expect(headline).toBeNull();
      return;
    }
    const cheapest = withheld[0]!;
    expect(headline!.listings).toBe(cheapest.minimumToPublish.gap);
    expect(headline!.action).toContain(cheapest.cityName);
    expect(headline!.action).toContain(String(cheapest.minimumToPublish.gap));
    /* It must name a real place that is genuinely short, never a city with
       nothing to do. */
    expect(cheapest.minimumToPublish.localities.length).toBeGreaterThan(0);
    expect(headline!.action).toContain(cheapest.minimumToPublish.localities[0]!);
  });

  it("says what stops being withheld", () => {
    const headline = acquisitionHeadline();
    if (!headline) return;
    expect(headline.unlocks.join(" ")).toMatch(/price index/i);
    // A blocker-derived clause, lowercased and without a trailing full stop.
    for (const unlock of headline.unlocks.slice(2)) {
      expect(unlock.endsWith(".")).toBe(false);
      expect(unlock[0]).toBe(unlock[0]!.toLowerCase());
    }
  });

  it("is null, not empty, when nothing is gated", () => {
    // Guards the caller: `null` means "nothing to do", and must not be
    // confused with "something to do that costs nothing".
    if (withheld.length > 0) expect(acquisitionHeadline()).not.toBeNull();
  });
});

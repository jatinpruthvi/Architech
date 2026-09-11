/* Market-trends report contract (StudyArena round-12, contestant B §2).

   The point of this file is the thing B's recommendation would have got wrong.
   B asks for a "Real Estate Market Trends in [City] 2026" page with price per
   square foot, rental yields and inventory by micro-neighbourhood, pitched to
   journalists. Measured against the fixture inventory, the launch city has six
   listings across six localities — one each, two of them rentals — so the
   obvious version of that page publishes a single flat's asking price as a
   locality median and then asks a newspaper to cite it.

   So the tests pin the two properties that make the asset safe to publish:
   a figure is never emitted from a sample too small to support it, and rent is
   never aggregated into a sale price. */
import { describe, expect, it } from "vitest";
import { getListingsByCity, getListingsByLocality } from "@/lib/repositories";
import { MIN_SAMPLE_FOR_PUBLISHED_STAT, cityPriceTrends, localityPriceTrends, monthlyRentInr, salePriceInr } from "./price-trends";
import { cityMarketTrends, marketTrendBlockers } from "./market-trends";

const THIN_CITY = "ahmedabad";
const WELL_COVERED_CITY = "mumbai";

describe("price trends keep rent and sale apart", () => {
  /* Bopal's only listing is a rental at ₹22,000/month. Before this fix the
     locality "median price" was 2,200,000 — one month's rent × 100 presented
     as a sale price. */
  it("reports no sale median for a rental-only locality", () => {
    const listings = getListingsByLocality("bopal");
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((listing) => (listing.transaction ?? "buy") === "rent")).toBe(true);

    const summary = localityPriceTrends("bopal");
    expect(summary.medianPriceInr).toBeNull();
    expect(summary.avgPricePerSqftInr).toBeNull();
    expect(summary.published).toBe(false);
    // It is not empty, though — it holds rentals, and that is different.
    expect(summary.count).toBe(listings.length);
    expect(summary.saleSampleSize).toBe(0);
    expect(summary.rentSampleSize).toBeGreaterThan(0);
  });

  it("reads a rental through the unit-aware helper, not as a sale price", () => {
    const rental = getListingsByLocality("bopal")[0];
    expect(salePriceInr(rental)).toBeNull();
    expect(monthlyRentInr(rental)).toBe(22_000);
  });

  it("excludes rentals from the city median", () => {
    const summary = cityPriceTrends(THIN_CITY);
    const salePrices = getListingsByCity(THIN_CITY)
      .map(salePriceInr)
      .filter((value): value is number => value !== null);
    const rents = getListingsByCity(THIN_CITY)
      .map(monthlyRentInr)
      .filter((value): value is number => value !== null);

    expect(rents.length).toBeGreaterThan(0);
    // No rental may influence the median, in either direction.
    if (summary.medianPriceInr !== null) {
      const minSale = Math.min(...salePrices);
      expect(summary.medianPriceInr).toBeGreaterThanOrEqual(minSale);
    }
    expect(summary.saleSampleSize).toBe(salePrices.length);
    expect(summary.rentSampleSize).toBe(rents.length);
  });
});

describe("published figures clear the sample bar", () => {
  it("withholds a median built from fewer than the minimum sample", () => {
    // Every Ahmedabad locality holds at most one sale listing.
    for (const slug of ["paldi", "navrangpura", "prahlad-nagar", "thaltej"]) {
      const summary = localityPriceTrends(slug);
      expect(summary.saleSampleSize).toBeLessThan(MIN_SAMPLE_FOR_PUBLISHED_STAT);
      expect(summary.medianPriceInr).toBeNull();
      expect(summary.minPriceInr).toBeNull();
      expect(summary.maxPriceInr).toBeNull();
      expect(summary.avgPricePerSqftInr).toBeNull();
      expect(summary.published).toBe(false);
    }
  });

  it("publishes a locality that clears the bar, with its sample attached", () => {
    const summary = localityPriceTrends("bandra-west", WELL_COVERED_CITY);
    expect(summary.saleSampleSize).toBeGreaterThanOrEqual(MIN_SAMPLE_FOR_PUBLISHED_STAT);
    expect(summary.published).toBe(true);
    expect(summary.medianPriceInr).not.toBeNull();
    expect(summary.avgPricePerSqftInr).not.toBeNull();
  });

  /* The invariant, not just the fixtures: whatever the inventory becomes, a
     published figure implies a sample at or above the bar. */
  it("never publishes a figure below the bar, for any locality in any city", () => {
    const checked = new Set<string>();
    for (const city of ["ahmedabad", WELL_COVERED_CITY, "pune", "delhi"]) {
      for (const listing of getListingsByCity(city)) {
        const key = `${city}:${listing.localitySlug}`;
        if (checked.has(key)) continue;
        checked.add(key);
        const summary = localityPriceTrends(listing.localitySlug, city);
        if (summary.published) {
          expect(summary.saleSampleSize).toBeGreaterThanOrEqual(MIN_SAMPLE_FOR_PUBLISHED_STAT);
        } else {
          expect(summary.medianPriceInr).toBeNull();
          expect(summary.avgPricePerSqftInr).toBeNull();
        }
      }
    }
    expect(checked.size).toBeGreaterThan(0);
  });
});

describe("city market-trends report", () => {
  /* The headline finding. Ahmedabad is the launch market, and it is the one
     city that cannot support the asset: four sale listings across the whole
     city, at most one in any locality. The city-level figure clears the bar;
     the micro-neighbourhood breakdown B wants does not. */
  it("describes the launch city as not yet publishable, with reasons", () => {
    const report = cityMarketTrends(THIN_CITY);
    expect(report.cityName).toBe("Ahmedabad");
    expect(report.minSample).toBe(MIN_SAMPLE_FOR_PUBLISHED_STAT);
    expect(report.publishable).toBe(false);
    // The blockers must name what is missing, not just that something is.
    expect(report.blockers.join(" ")).toMatch(/No locality in this city has enough sale listings/);
    expect(report.coverage.published).toBe(0);
  });

  it("withholds every locality row that is too thin instead of rounding it into respectability", () => {
    const report = cityMarketTrends(THIN_CITY);
    expect(report.localities.length).toBeGreaterThan(0);
    for (const row of report.localities) {
      if (row.published) {
        expect(row.saleSampleSize).toBeGreaterThanOrEqual(MIN_SAMPLE_FOR_PUBLISHED_STAT);
      } else {
        expect(row.medianPriceInr).toBeNull();
        expect(row.avgPricePerSqftInr).toBeNull();
        expect(row.deltaPct).toBeNull();
      }
    }
    expect(report.coverage.published).toBe(0);
  });

  it("publishes a city whose inventory clears the bar", () => {
    const report = cityMarketTrends(WELL_COVERED_CITY);
    expect(report.citySampleSize).toBeGreaterThanOrEqual(MIN_SAMPLE_FOR_PUBLISHED_STAT);
    expect(report.cityPublished).toBe(true);
    expect(report.cityMedianPriceInr).not.toBeNull();
    expect(report.cityAvgPricePerSqftInr).not.toBeNull();
    expect(report.publishable).toBe(true);
    expect(report.blockers).toEqual([]);
  });

  it("compares a locality against its own city, not against the country", () => {
    const mumbai = cityMarketTrends(WELL_COVERED_CITY);
    const baseline = mumbai.cityAvgPricePerSqftInr;
    expect(baseline).not.toBeNull();
    for (const row of mumbai.localities.filter((entry) => entry.published)) {
      expect(row.avgPricePerSqftInr).not.toBeNull();
      const expected = Math.round(((row.avgPricePerSqftInr! - baseline!) / baseline!) * 100);
      expect(row.deltaPct).toBe(expected);
    }
  });

  it("reports coverage rather than hiding the gap", () => {
    for (const city of [THIN_CITY, WELL_COVERED_CITY]) {
      const report = cityMarketTrends(city);
      expect(report.coverage.total).toBe(report.localities.length);
      expect(report.coverage.published + report.coverage.withheld + report.coverage.empty).toBe(
        report.coverage.total,
      );
      // A thin sample and no inventory are different gaps and stay separate.
      for (const row of report.localities) {
        if (row.saleSampleSize === 0) expect(row.published).toBe(false);
      }
    }
  });

  it("carries methodology and limitations with the table", () => {
    const report = cityMarketTrends(WELL_COVERED_CITY);
    expect(report.methodology.length).toBeGreaterThan(0);
    expect(report.limitations.length).toBeGreaterThan(0);
    // The snapshot date must be present, or the table has no period.
    expect(report.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.asOfLabel.length).toBeGreaterThan(0);
  });

  it("exposes blockers without building the whole report", () => {
    expect(marketTrendBlockers(THIN_CITY).length).toBeGreaterThan(0);
    expect(marketTrendBlockers(WELL_COVERED_CITY)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { boundsContainPoint, boundsForPoints, listingWithinBounds, makeListingMapPoints, makeLocalityClusters, parseBoundsParam, parseMarker } from "./map";
import { getListings, getLocalities } from "./repositories";

describe("map/list synchronization helpers", () => {
  it("parses OSM latitude,longitude markers without a launch-city fallback", () => {
    expect(parseMarker("23.011,72.559")).toEqual([72.559, 23.011]);
    expect(parseMarker("not-a-coordinate")).toBeNull();
    expect(boundsForPoints([])).toEqual([[68, 6], [98, 36]]);
  });

  it("creates map points for repository-backed listings", () => {
    const points = makeListingMapPoints(getListings(), getLocalities());
    expect(points).toHaveLength(getListings().length);
    expect(points.find((point) => point.id === "garden-courtyard")?.coordinates).toEqual([72.559, 23.011]);
  });

  it("clusters points by locality", () => {
    const clusters = makeLocalityClusters(makeListingMapPoints(getListings(), getLocalities()));
    expect(clusters.map((cluster) => cluster.localitySlug)).toContain("paldi");
    expect(clusters.every((cluster) => cluster.count >= 1)).toBe(true);
  });

  it("calculates padded bounds", () => {
    const bounds = boundsForPoints(makeListingMapPoints(getListings(), getLocalities()));
    expect(bounds[0][0]).toBeLessThan(bounds[1][0]);
    expect(bounds[0][1]).toBeLessThan(bounds[1][1]);
  });
});

describe('"search this area" bounds (I-8)', () => {
  it("parses a clean w,s,e,n box", () => {
    expect(parseBoundsParam("72.5,23.0,72.7,23.1")).toEqual({ west: 72.5, south: 23.0, east: 72.7, north: 23.1 });
  });

  it("rejects noise, inverted, zero-area, out-of-globe and planet-spanning boxes (never an empty page by accident)", () => {
    for (const raw of [null, "", "1,2,3", "1,2,3,4,5", "abc,1,2,3", "72.7,23.0,72.5,23.1", "72.5,23.1,72.7,23.0", "72.5,23.0,72.5,23.1", "-200,23,0,24", "0,0,180,90"]) {
      expect(parseBoundsParam(raw)).toBeNull();
    }
  });

  it("answers point containment inclusively at every edge", () => {
    const bounds = { west: 72.5, south: 23.0, east: 72.7, north: 23.1 };
    expect(boundsContainPoint(bounds, [72.6, 23.05])).toBe(true);
    expect(boundsContainPoint(bounds, [72.5, 23.1])).toBe(true);
    expect(boundsContainPoint(bounds, [72.4, 23.05])).toBe(false);
    expect(boundsContainPoint(bounds, [72.6, 22.9])).toBe(false);
  });

  it("includes listings whose LOCALITY marker is inside the box — and only those", () => {
    const localities = getLocalities();
    const listings = getListings();
    /* Paldi sits at [72.559, 23.011]; a tight box around it keeps only Paldi. */
    const tight = { west: 72.55, south: 23.0, east: 72.57, north: 23.02 };
    const kept = listings.filter((listing) => listingWithinBounds(listing, localities, tight));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((listing) => listing.localitySlug === "paldi")).toBe(true);
    /* No locality, no answer: a listing pinned to an unknown locality is
       excluded rather than guessed into the box. */
    expect(listingWithinBounds({ localitySlug: "nowhere", citySlug: "ahmedabad" }, localities, tight)).toBe(false);
    /* City-scoped: the same slug in another city cannot leak coordinates in. */
    const wrongCity = listings.find((listing) => listing.citySlug !== "ahmedabad");
    if (wrongCity) expect(listingWithinBounds(wrongCity, localities, tight)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { boundsForPoints, makeListingMapPoints, makeLocalityClusters, parseMarker } from "./map";
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

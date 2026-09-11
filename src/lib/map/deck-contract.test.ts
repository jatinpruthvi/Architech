import { describe, expect, it } from "vitest";
import { makeListingMapPoints, makeLocalityClusters } from "../map";
import { getListings, getLocalities } from "@/lib/repositories";
import {
  buildDeckHeatmapWeights,
  buildDeckScatterPoints,
  buildDeckScreenGrid,
  deckLayerKindsForFlags,
  resolveMapSurface,
  resolveMediaSurface,
} from "./deck-contract";

/* deck.gl layer contract + no-WebGL/no-video fallback (P1-MAP-001 / P1-UI-002).

   The architecture names MapLibre + deck.gl a Phase 1 capability but scopes the
   expensive layers behind flags ("advanced deck.gl layers behind flags"). What
   is testable without a GPU or a device is the CONTRACT: the deterministic data
   deck.gl consumes, the flag that gates each layer, and the fallback decision
   when WebGL or video is unavailable. The Redmi-class motion benchmark itself
   needs hardware and stays out of CI (blocked, §10). */

const points = makeListingMapPoints(getListings(), getLocalities());

describe("deck.gl layer data contract", () => {
  it("maps listings to scatter positions in a stable, lon/lat order", () => {
    const scatter = buildDeckScatterPoints(points);
    expect(scatter).toHaveLength(points.length);
    const paldi = scatter.find((point) => point.id === "garden-courtyard");
    expect(paldi?.position).toEqual([72.559, 23.011]);
  });

  it("drops listings without a valid locality coordinate rather than guessing", () => {
    const scatter = buildDeckScatterPoints([{ ...points[0], coordinates: [Number.NaN, 0] }]);
    expect(scatter).toHaveLength(0);
  });

  it("computes deterministic heatmap weights bounded to [0, 1], monotonic in price", () => {
    const weights = buildDeckHeatmapWeights(points);
    expect(weights).toHaveLength(points.length);
    for (const entry of weights) {
      expect(entry.weight).toBeGreaterThanOrEqual(0);
      expect(entry.weight).toBeLessThanOrEqual(1);
    }
    const byPrice = [...weights].sort((a, b) => (a.priceNum ?? 0) - (b.priceNum ?? 0));
    expect(byPrice[byPrice.length - 1].weight).toBeGreaterThanOrEqual(byPrice[0].weight);
  });

  it("aggregates a screen grid per locality, mirroring the cluster counts", () => {
    const grid = buildDeckScreenGrid(points);
    const clusters = makeLocalityClusters(points);
    expect(grid).toHaveLength(clusters.length);
    for (const cell of grid) {
      const cluster = clusters.find((item) => item.localitySlug === cell.localitySlug && item.citySlug === cell.citySlug);
      expect(cell.count).toBe(cluster?.count);
    }
  });

  it("gates heatmap and screen grid behind flags while scatter is always on", () => {
    expect(deckLayerKindsForFlags()).toEqual(["scatter"]);
    expect(deckLayerKindsForFlags({ deckHeatmap: true })).toEqual(["scatter", "heatmap"]);
    expect(deckLayerKindsForFlags({ deckScreenGrid: true })).toEqual(["scatter", "screen-grid"]);
    expect(deckLayerKindsForFlags({ deckHeatmap: true, deckScreenGrid: true })).toEqual(["scatter", "heatmap", "screen-grid"]);
  });
});

describe("no-WebGL / no-video fallback contract", () => {
  it("degrades to the list fallback when WebGL is unavailable", () => {
    expect(resolveMapSurface({ webgl: false })).toBe("list-fallback");
    expect(resolveMapSurface({ webgl: true })).toBe("map");
  });

  it("shows a poster when a listing has no video, whatever the device", () => {
    expect(resolveMediaSurface({ hasVideo: false, videoSupported: true })).toBe("poster");
    expect(resolveMediaSurface({ hasVideo: false, videoSupported: false })).toBe("poster");
  });

  it("shows video only when the listing has one AND the device can play it", () => {
    expect(resolveMediaSurface({ hasVideo: true, videoSupported: true })).toBe("video");
    expect(resolveMediaSurface({ hasVideo: true, videoSupported: false })).toBe("poster");
  });
});

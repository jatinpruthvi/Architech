/* deck.gl layer contract + no-WebGL/no-video fallback (P1-MAP-001 / P1-UI-002).

   The normative architecture names MapLibre + deck.gl a Phase 1 capability and
   scopes the expensive layers behind flags. What can be verified without a GPU
   or a device is this CONTRACT: the deterministic data deck.gl consumes, the
   flag that gates each layer, and the fallback decision when WebGL or video is
   unavailable. It is pure and server-safe so it is testable in CI; the
   Redmi-class motion benchmark is a hardware gate and stays out of CI (§10). */

import { makeLocalityClusters, type ListingMapPoint } from "../map";

export type DeckLayerKind = "scatter" | "heatmap" | "screen-grid";

export type DeckFlags = {
  /** Advanced price-density heatmap, off until a data/UX review approves it. */
  deckHeatmap?: boolean;
  /** Advanced locality-level screen grid, off by default. */
  deckScreenGrid?: boolean;
};

/** Which deck.gl layers a build renders. Scatter is the always-on baseline;
    heatmap and screen-grid are the "advanced layers behind flags" the
    architecture scopes. */
export function deckLayerKindsForFlags(flags: DeckFlags = {}): DeckLayerKind[] {
  const kinds: DeckLayerKind[] = ["scatter"];
  if (flags.deckHeatmap) kinds.push("heatmap");
  if (flags.deckScreenGrid) kinds.push("screen-grid");
  return kinds;
}

export type DeckScatterPoint = {
  id: string;
  position: [number, number];
  priceLabel: string;
};

/** Scatter layer data: one point per listing with a reviewed locality marker.
    Invalid coordinates are dropped — a data gap is an absence, never a guess. */
export function buildDeckScatterPoints(points: ListingMapPoint[]): DeckScatterPoint[] {
  return points.flatMap((point) => {
    const [lon, lat] = point.coordinates;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
    return [{ id: point.id, position: [lon, lat] as [number, number], priceLabel: point.price }];
  });
}

export type DeckHeatmapPoint = {
  position: [number, number];
  priceNum: number;
  /** Price normalized to [0, 1] within the dataset, for the heatmap weight. */
  weight: number;
};

/** Heatmap layer data: price density. Weight is the price normalized to the
    dataset's own min/max, so the layer compares listings against each other
    rather than claiming an absolute price on a map. A single point is neutral
    (weight 0.5); a flat dataset is all-neutral rather than dividing by zero. */
export function buildDeckHeatmapWeights(points: ListingMapPoint[]): DeckHeatmapPoint[] {
  const priced = points
    .map((point) => {
      const [lon, lat] = point.coordinates;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      const priceNum = Number.parseFloat(point.price.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(priceNum)) return null;
      return { position: [lon, lat] as [number, number], priceNum };
    })
    .filter((entry): entry is { position: [number, number]; priceNum: number } => entry !== null);

  const values = priced.map((entry) => entry.priceNum);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return priced.map((entry) => ({
    ...entry,
    weight: span === 0 ? 0.5 : (entry.priceNum - min) / span,
  }));
}

export type DeckScreenGridCell = {
  citySlug: string;
  localitySlug: string;
  position: [number, number];
  count: number;
};

/** Screen-grid layer data: one aggregated cell per locality, matching the
    cluster contract `makeLocalityClusters` already publishes. */
export function buildDeckScreenGrid(points: ListingMapPoint[]): DeckScreenGridCell[] {
  return makeLocalityClusters(points).map((cluster) => ({
    citySlug: cluster.citySlug,
    localitySlug: cluster.localitySlug,
    position: cluster.coordinates,
    count: cluster.count,
  }));
}

export type MapCapabilities = {
  /** Whether the browser can create a WebGL context. */
  webgl: boolean;
};

/** Which discovery surface a device gets. WebGL is the whole game for
    MapLibre/deck.gl: without it the map must degrade to the synchronized list,
    never render a blank panel. */
export function resolveMapSurface(capabilities: MapCapabilities): "map" | "list-fallback" {
  return capabilities.webgl ? "map" : "list-fallback";
}

export type MediaCapabilities = {
  hasVideo: boolean;
  videoSupported: boolean;
};

/** Video surface decision: a listing shows a video only when it HAS one AND the
    device can play it; otherwise the poster image is the honest presentation.
    "Video remains unimplemented — no assets exist", so every real listing
    resolves to `poster` today, which is exactly the fallback being pinned. */
export function resolveMediaSurface(capabilities: MediaCapabilities): "video" | "poster" {
  return capabilities.hasVideo && capabilities.videoSupported ? "video" : "poster";
}

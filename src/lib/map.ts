import type { Property } from "@/lib/repositories";
import type { Locality } from "@/lib/localities";

/* ---------- "Search this area" bounds (I-8) ----------
 *
 * Precision rule: published listing positions are LOCALITY-level (public
 * coordinates are approximations by contract — see the location docs), so a
 * bounds search includes a listing when its LOCALITY's reviewed marker falls
 * inside the rectangle. That is exactly how far the data honours; inventing a
 * doorstep-level match would silently promise precision the signal never had.
 */
export type MapBounds = { west: number; south: number; east: number; north: number };

/** Strict bbox parser for the `?bbox=w,s,e,n` URL contract. Anything even
    slightly off (wrong arity, NaN, inverted or zero-area box, out-of-globe
    coordinates) yields null and the search behaves as if no bbox was given —
    a malformed box must NOT return an empty page. A sane India-span sanity
    cap (≤ 8° per side ≈ one metro region plus margin) keeps an absurd query
    (whole planet) from silently being "everything", but rejecting it rather
    than clamping keeps the URL the truth of what the user saw. */
export function parseBoundsParam(raw: string | null | undefined): MapBounds | null {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || south > 90 || north < -90 || north > 90) return null;
  if (west >= east || south >= north) return null;
  if (east - west > 8 || north - south > 8) return null;
  return { west, south, east, north };
}

export function boundsContainPoint(bounds: MapBounds, coordinates: [number, number]): boolean {
  const [lon, lat] = coordinates;
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

/** True when the listing's locality marker (city-scoped, matching
    makeListingMapPoints' provenance rule) lies inside the bounds. */
export function listingWithinBounds(property: Pick<Property, "localitySlug" | "citySlug">, localities: Locality[], bounds: MapBounds): boolean {
  const locality = localities.find((item) => item.slug === property.localitySlug && item.citySlug === property.citySlug);
  const coordinates = locality ? parseMarker(locality.marker) : null;
  return coordinates ? boundsContainPoint(bounds, coordinates) : false;
}

export type ListingMapPoint = {
  id: string;
  title: string;
  citySlug: string;
  locality: string;
  localitySlug: string;
  price: string;
  coordinates: [number, number];
};

export type MapCluster = {
  citySlug: string;
  localitySlug: string;
  locality: string;
  count: number;
  coordinates: [number, number];
  listingIds: string[];
};

/** Parse a registry marker without inventing coordinates for malformed data. */
export function parseMarker(marker: string): [number, number] | null {
  const [latRaw, lonRaw] = marker.split(",");
  const lat = Number.parseFloat(latRaw);
  const lon = Number.parseFloat(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lon, lat];
}

/** Listings without a reviewed locality coordinate are omitted from the map;
 * they remain in the synchronized result list. Locality matching is city-scoped
 * so a same-slug locality in another city can never supply the marker. */
export function makeListingMapPoints(properties: Property[], localities: Locality[]): ListingMapPoint[] {
  return properties.flatMap((property) => {
    const locality = localities.find((item) => item.slug === property.localitySlug && item.citySlug === property.citySlug);
    const coordinates = locality ? parseMarker(locality.marker) : null;
    if (!coordinates) return [];
    return [{
      id: property.id,
      title: property.title,
      citySlug: property.citySlug,
      locality: property.locality,
      localitySlug: property.localitySlug,
      price: property.price,
      coordinates,
    }];
  });
}

export function makeLocalityClusters(points: ListingMapPoint[]): MapCluster[] {
  const clusters = new Map<string, MapCluster>();
  for (const point of points) {
    const key = `${point.citySlug}:${point.localitySlug}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      existing.listingIds.push(point.id);
    } else {
      clusters.set(key, {
        citySlug: point.citySlug,
        localitySlug: point.localitySlug,
        locality: point.locality,
        count: 1,
        coordinates: point.coordinates,
        listingIds: [point.id],
      });
    }
  }
  return [...clusters.values()];
}

export function boundsForPoints(points: ListingMapPoint[]): [[number, number], [number, number]] {
  // National frame for a genuinely empty map; never a launch-city fallback.
  if (points.length === 0) return [[68, 6], [98, 36]];
  const lngs = points.map((point) => point.coordinates[0]);
  const lats = points.map((point) => point.coordinates[1]);
  const pad = 0.025;
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

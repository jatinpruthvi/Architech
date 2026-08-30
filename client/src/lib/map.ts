import type { Property } from "@/lib/repositories";
import type { Locality } from "@/lib/localities";

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

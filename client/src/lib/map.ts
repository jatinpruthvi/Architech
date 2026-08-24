import type { Property } from "@/lib/repositories";
import type { Locality } from "@/lib/localities";

export type ListingMapPoint = {
  id: string;
  title: string;
  locality: string;
  localitySlug: string;
  price: string;
  coordinates: [number, number];
};

export type MapCluster = {
  localitySlug: string;
  locality: string;
  count: number;
  coordinates: [number, number];
  listingIds: string[];
};

export function parseMarker(marker: string): [number, number] {
  const [latRaw, lonRaw] = marker.split(",");
  const lat = Number.parseFloat(latRaw);
  const lon = Number.parseFloat(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [72.559, 23.011];
  return [lon, lat];
}

export function makeListingMapPoints(properties: Property[], localities: Locality[]): ListingMapPoint[] {
  return properties.map((property) => {
    const locality = localities.find((item) => item.slug === property.localitySlug);
    return {
      id: property.id,
      title: property.title,
      locality: property.locality,
      localitySlug: property.localitySlug,
      price: property.price,
      coordinates: parseMarker(locality?.marker ?? "23.011,72.559"),
    };
  });
}

export function makeLocalityClusters(points: ListingMapPoint[]): MapCluster[] {
  const clusters = new Map<string, MapCluster>();
  for (const point of points) {
    const existing = clusters.get(point.localitySlug);
    if (existing) {
      existing.count += 1;
      existing.listingIds.push(point.id);
    } else {
      clusters.set(point.localitySlug, {
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
  if (points.length === 0) return [[72.43, 22.96], [72.64, 23.10]];
  const lngs = points.map((point) => point.coordinates[0]);
  const lats = points.map((point) => point.coordinates[1]);
  const pad = 0.025;
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

"use client";
/* MapLibre map/list synchronization with a no-WebGL/list fallback. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { LngLatBoundsLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import { Crosshair } from "lucide-react";
import { toast } from "sonner";
import type { Property } from "@/lib/repositories";
import { getLocalities } from "@/lib/repositories/localities";
import { boundsForPoints, makeListingMapPoints, makeLocalityClusters, type MapBounds } from "@/lib/map";

type MapLibreModule = typeof import("maplibre-gl");

function ensureMaplibreCss() {
  if (document.getElementById("maplibre-css")) return;
  const link = document.createElement("link");
  link.id = "maplibre-css";
  link.rel = "stylesheet";
  link.href = "/vendor/maplibre-gl.css";
  document.head.appendChild(link);
}

/** Load the production ESM build from /public/vendor (copied in next.config).
 *  A non-literal specifier keeps Turbopack from inlining MapLibre into chunks. */
function loadMaplibre(): Promise<MapLibreModule> {
  const spec = "/vendor/maplibre-gl.mjs";
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ spec) as Promise<MapLibreModule>;
}

type MapListSyncProps = {
  listings: Property[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** "Search this area": handed the current viewport rectangle. Absent or a
      not-ready map degrades the control to an explanation toast, never a dead
      click (the behaviour that audit I-8 named). */
  onSearchArea?: (bounds: MapBounds) => void;
  className?: string;
  copy: {
    mapLabel: string;
    searchArea: string;
    searchingArea: string;
    searchingAreaDescription: string;
    liveCartography: string;
    mapCopy: string;
  };
};

export default function MapListSync({ listings, selectedId, onSelect, onSearchArea, className = "", copy }: MapListSyncProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [mapFailed, setMapFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [maplibreModule, setMaplibreModule] = useState<MapLibreModule | null>(null);
  /* B-19: a single transient tile/network error used to disable the map for
     the whole session. Attempts are retryable — a failed map must degrade, not
     be a dead end. */
  const [mapAttempt, setMapAttempt] = useState(0);
  const retryMap = () => {
    setMapFailed(false);
    setMapAttempt((attempt) => attempt + 1);
  };
  const points = useMemo(() => makeListingMapPoints(listings, getLocalities()), [listings]);
  const clusters = useMemo(() => makeLocalityClusters(points), [points]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current || mapFailed) return;
    let disposed = false;

    ensureMaplibreCss();
    void loadMaplibre()
      .then((maplibregl) => {
        if (disposed || !containerRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          },
          center: [78.9629, 20.5937],
          zoom: 4,
          attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
        map.on("error", () => setMapFailed(true));
        mapRef.current = map;
        setMaplibreModule(maplibregl);
        setMapReady(true);
      })
      .catch(() => setMapFailed(true));

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [mapFailed, mapAttempt]);

  useEffect(() => {
      const map = mapRef.current;
    if (!map || !maplibreModule) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    for (const point of points) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `arch-map-marker${point.id === selectedId ? " is-selected" : ""}`;
      button.setAttribute("aria-label", `${point.title}, ${point.price}, ${point.locality}`);
      button.innerHTML = `<span>${point.price}</span>`;
      button.addEventListener("click", () => {
        onSelect(point.id);
        document.getElementById(`listing-${point.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      });

      const marker = new maplibreModule.Marker({ element: button, anchor: "bottom" })
        .setLngLat(point.coordinates)
        .addTo(map);
      markersRef.current.set(point.id, marker);
    }

    if (points.length > 0) {
      map.fitBounds(boundsForPoints(points) as LngLatBoundsLike, { padding: 46, maxZoom: 13, duration: 500 });
    }
  }, [mapReady, maplibreModule, onSelect, points, selectedId]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      marker.getElement().classList.toggle("is-selected", id === selectedId);
    });
    const selected = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (selected && mapRef.current) {
      mapRef.current.easeTo({ center: selected.getLngLat(), zoom: Math.max(mapRef.current.getZoom(), 12), duration: 450 });
    }
  }, [selectedId]);

  return (
    <aside className={`atlas-map relative min-h-[480px] overflow-hidden border border-ink/12 bg-sand ${className}`} aria-label={copy.mapLabel}>
      {!mapFailed && <div ref={containerRef} className="absolute inset-0" />}
      {mapFailed && (
        <div className="absolute inset-0 overflow-auto bg-sand p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="stamp font-semibold text-brick">Map fallback · list remains available</p>
            <button type="button" onClick={retryMap} className="touch-44 rounded-lg border border-brick/50 px-3 py-1.5 stamp font-semibold text-brick hover:bg-paper">
              Retry map
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {points.map((point) => (
              <button key={point.id} onClick={() => onSelect(point.id)} className={`w-full border px-3 py-3 text-left text-sm ${point.id === selectedId ? "border-brick bg-paper text-brick" : "border-ink/15 bg-paper/80 text-ink/75"}`}>
                <span className="font-semibold">{point.title}</span>
                <span className="mt-1 block stamp !text-[10px] text-ink/60">{point.price} · {point.locality}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        /* Fires the real bounds search when the map shows a meaningful
           rectangle; the toast copy remains as the feedback for the not-ready
           state (map still loading, or the fallback list) so the control is
           never inert anywhere. */
        onClick={() => {
          const bounds = mapRef.current?.getBounds();
          if (bounds && onSearchArea) {
            onSearchArea({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() });
          } else {
            toast(copy.searchingArea, { description: copy.searchingAreaDescription });
          }
        }}
        className="night-fill touch-44 absolute left-1/2 top-4 z-10 inline-flex -translate-x-1/2 items-center gap-2 bg-night px-5 stamp !text-[11px] font-semibold text-cream shadow-lg transition-transform hover:-translate-y-0.5">
        <Crosshair size={14} className="text-ember" /> {copy.searchArea}
      </button>

      <div className="pointer-events-none absolute inset-x-5 bottom-5 z-10 border border-ink/12 bg-paper/95 p-5 backdrop-blur">
        <p className="stamp !text-[10px] font-semibold text-brick">{copy.liveCartography}</p>
        <p className="mt-2 text-sm leading-6 text-ink/65">{copy.mapCopy}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {clusters.map((cluster) => (
            <span key={`${cluster.citySlug}:${cluster.localitySlug}`} className="border border-ink/15 bg-sand/70 px-2 py-1 stamp !text-[9px] text-ink/65">
              {cluster.locality} · {cluster.count}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

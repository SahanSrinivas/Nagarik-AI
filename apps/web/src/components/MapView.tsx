"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

import type { CrewRoute, Issue } from "@/lib/api";

interface Props {
  issues?: Issue[];
  routes?: CrewRoute[];
  hotspots?: GeoJSON.FeatureCollection | null;
  wards?: GeoJSON.FeatureCollection | null;
  center?: [number, number];
  zoom?: number;
  onPick?: (lng: number, lat: number) => void;
  className?: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const CITY: [number, number] = [
  Number(process.env.NEXT_PUBLIC_CITY_CENTER_LNG ?? 77.5946),
  Number(process.env.NEXT_PUBLIC_CITY_CENTER_LAT ?? 12.9716),
];

const SEV_COLOR = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

// One distinct hue per crew route — cycles after 10.
const ROUTE_COLORS = [
  "#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899",
  "#0ea5e9", "#84cc16", "#f97316", "#8b5cf6", "#14b8a6",
];

export function MapView({
  issues = [],
  routes = [],
  hotspots = null,
  wards = null,
  center = CITY,
  zoom = 11,
  onPick,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // --- bootstrap ---
  useEffect(() => {
    if (!ref.current || mapRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/light-v11",
      center,
      zoom,
    });
    if (onPick) mapRef.current.on("click", (e) => onPick(e.lngLat.lng, e.lngLat.lat));
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [center, zoom, onPick]);

  // --- issue pins ---
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = issues.map((iss) => {
      const el = document.createElement("div");
      el.className = "h-3.5 w-3.5 rounded-full border-2 border-white shadow";
      el.style.background = SEV_COLOR[Math.max(0, Math.min(4, iss.severity - 1))];
      return new mapboxgl.Marker(el)
        .setLngLat([iss.lng, iss.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<div style="font-family:Inter,system-ui;font-size:12px"><strong>${iss.type}</strong><br/>sev ${iss.severity} · ${iss.status}<br/>${iss.address ?? ""}</div>`,
          ),
        )
        .addTo(mapRef.current!);
    });
  }, [issues]);

  // --- crew routes as polylines + numbered stops ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ensure = () => applyRoutes(map, routes);
    if (map.isStyleLoaded()) ensure();
    else map.once("load", ensure);
  }, [routes]);

  // --- hotspot heatmap ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ensure = () => applyHotspots(map, hotspots);
    if (map.isStyleLoaded()) ensure();
    else map.once("load", ensure);
  }, [hotspots]);

  // --- ward polygons ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ensure = () => applyWards(map, wards);
    if (map.isStyleLoaded()) ensure();
    else map.once("load", ensure);
  }, [wards]);

  if (!TOKEN) {
    return (
      <div className={`rounded border bg-amber-50 p-4 text-sm text-amber-700 ${className ?? ""}`}>
        Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>apps/web/.env.local</code> to render the map.
      </div>
    );
  }

  return <div ref={ref} className={className ?? "h-[60vh] w-full rounded-xl"} />;
}

// -------------------------------------------------------------------------

function applyRoutes(map: mapboxgl.Map, routes: CrewRoute[]) {
  // Wipe prior route layers.
  for (let i = 0; i < 50; i++) {
    const id = `route-${i}`;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
    if (map.getLayer(`${id}-stops`)) map.removeLayer(`${id}-stops`);
    if (map.getSource(`${id}-stops`)) map.removeSource(`${id}-stops`);
    if (map.getLayer(`${id}-depot`)) map.removeLayer(`${id}-depot`);
    if (map.getSource(`${id}-depot`)) map.removeSource(`${id}-depot`);
  }

  routes.forEach((r, idx) => {
    if (r.stops.length === 0) return;
    const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
    const id = `route-${idx}`;

    // Polyline: depot → stops in order → depot.
    const coords: [number, number][] = [
      [r.depot.lng, r.depot.lat],
      ...r.stops.map((s) => [s.lng, s.lat] as [number, number]),
      [r.depot.lng, r.depot.lat],
    ];
    map.addSource(id, {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: { name: r.crew_name } },
    });
    map.addLayer({
      id,
      type: "line",
      source: id,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color, "line-width": 3.5, "line-opacity": 0.85 },
    });

    // Stops as numbered circles colored by severity.
    map.addSource(`${id}-stops`, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: r.stops.map((s, i) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          properties: { order: i + 1, type: s.type, severity: s.severity, color: SEV_COLOR[Math.max(0, Math.min(4, s.severity - 1))] },
        })),
      },
    });
    map.addLayer({
      id: `${id}-stops`,
      type: "circle",
      source: `${id}-stops`,
      paint: {
        "circle-radius": 11,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
    map.addLayer({
      id: `${id}-stops-label`,
      type: "symbol",
      source: `${id}-stops`,
      layout: {
        "text-field": ["to-string", ["get", "order"]],
        "text-size": 10,
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff" },
    });

    // Depot marker.
    map.addSource(`${id}-depot`, {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "Point", coordinates: [r.depot.lng, r.depot.lat] }, properties: { name: r.crew_name } },
    });
    map.addLayer({
      id: `${id}-depot`,
      type: "circle",
      source: `${id}-depot`,
      paint: {
        "circle-radius": 8,
        "circle-color": color,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#0f172a",
      },
    });
  });

  // Auto-fit to all stops if any routes have content.
  const bounds = new mapboxgl.LngLatBounds();
  let touched = false;
  routes.forEach((r) => {
    bounds.extend([r.depot.lng, r.depot.lat]);
    r.stops.forEach((s) => { bounds.extend([s.lng, s.lat]); touched = true; });
  });
  if (touched) map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 13 });
}

function applyWards(map: mapboxgl.Map, wards: GeoJSON.FeatureCollection | null) {
  const SRC = "wards-src";
  const FILL = "wards-fill";
  const LINE = "wards-line";
  if (map.getLayer(FILL)) map.removeLayer(FILL);
  if (map.getLayer(LINE)) map.removeLayer(LINE);
  if (map.getSource(SRC)) map.removeSource(SRC);
  if (!wards || wards.features.length === 0) return;

  map.addSource(SRC, { type: "geojson", data: wards });
  // Translucent fill — sit BELOW issue pins and route polylines.
  map.addLayer({
    id: FILL,
    type: "fill",
    source: SRC,
    paint: { "fill-color": "#10b981", "fill-opacity": 0.06 },
  }, map.getLayer("wards-fill-noop") ? undefined : undefined);
  map.addLayer({
    id: LINE,
    type: "line",
    source: SRC,
    paint: { "line-color": "#10b981", "line-width": 1, "line-opacity": 0.45 },
  });
}


function applyHotspots(map: mapboxgl.Map, hotspots: GeoJSON.FeatureCollection | null) {
  const ID = "hotspots";
  if (map.getLayer(ID)) map.removeLayer(ID);
  if (map.getSource(ID)) map.removeSource(ID);
  if (!hotspots || hotspots.features.length === 0) return;

  map.addSource(ID, { type: "geojson", data: hotspots });
  map.addLayer({
    id: ID,
    type: "heatmap",
    source: ID,
    paint: {
      "heatmap-weight": ["coalesce", ["get", "risk"], 0.5],
      "heatmap-intensity": 1.4,
      "heatmap-radius": 28,
      "heatmap-opacity": 0.7,
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0,    "rgba(0,0,0,0)",
        0.2,  "rgba(132,204,22,0.6)",
        0.5,  "rgba(234,179,8,0.7)",
        0.8,  "rgba(249,115,22,0.8)",
        1,    "rgba(239,68,68,0.9)",
      ],
    },
  });
}

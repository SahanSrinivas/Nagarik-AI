"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

import type { Issue } from "@/lib/api";

interface Props {
  issues: Issue[];
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

export function MapView({ issues, center = CITY, zoom = 11, onPick, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!ref.current || mapRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom,
    });
    if (onPick) {
      mapRef.current.on("click", (e) => onPick(e.lngLat.lng, e.lngLat.lat));
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [center, zoom, onPick]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = issues.map((iss) => {
      const el = document.createElement("div");
      el.className = "h-4 w-4 rounded-full border-2 border-white shadow";
      el.style.background = SEV_COLOR[Math.max(0, Math.min(4, iss.severity - 1))];
      return new mapboxgl.Marker(el)
        .setLngLat([iss.lng, iss.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong>${iss.type}</strong><br/>sev ${iss.severity} · ${iss.status}<br/>${iss.address ?? ""}`,
          ),
        )
        .addTo(mapRef.current!);
    });
  }, [issues]);

  if (!TOKEN) {
    return (
      <div className={`rounded border bg-amber-50 p-4 text-sm text-amber-700 ${className ?? ""}`}>
        Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>apps/web/.env.local</code> to render the map.
      </div>
    );
  }

  return <div ref={ref} className={className ?? "h-[60vh] w-full rounded-xl"} />;
}

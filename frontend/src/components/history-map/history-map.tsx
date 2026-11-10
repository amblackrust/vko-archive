"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { HistoricalEvent } from "@/lib/api/memory";

// Исторические объекты — повёрнутые квадраты цвета accent: не путаются с круглыми маркерами карты филиалов.
function pointIcon(selected: boolean) {
  const size = selected ? 20 : 15;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;transform:rotate(45deg);border:2px solid var(--accent-soft);background:${
      selected ? "var(--primary)" : "var(--accent)"
    };box-shadow:0 0 0 1px var(--accent-soft-foreground)"></span>`,
  });
}

function Fit({ points, selected }: { points: HistoricalEvent[]; selected?: string }) {
  const map = useMap();
  useEffect(() => {
    const target = points.find((p) => p.slug === selected);
    if (target) {
      map.flyTo([target.lat!, target.lng!], Math.max(map.getZoom(), 9), { duration: 0.6 });
    } else if (points.length > 0) {
      map.fitBounds(points.map((p) => [p.lat!, p.lng!] as [number, number]), { padding: [30, 30], maxZoom: 9 });
    }
  }, [map, points, selected]);
  return null;
}

interface Props {
  points: HistoricalEvent[];
  selected?: string;
  onSelect: (slug: string) => void;
  label: string;
  tileErrorText: string;
}

export default function HistoryMap({ points, selected, onSelect, label, tileErrorText }: Props) {
  const [tilesFailed, setTilesFailed] = useState(false);
  return (
    <div className="relative h-full w-full">
      <MapContainer center={[49.6, 83]} zoom={7} scrollWheelZoom={false} className="h-full w-full" aria-label={label} style={{ background: "var(--surface-muted)" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }}
        />
        <Fit points={points} selected={selected} />
        {points.map((p) => (
          <Marker key={p.slug} position={[p.lat!, p.lng!]} icon={pointIcon(p.slug === selected)} title={p.title} eventHandlers={{ click: () => onSelect(p.slug) }}>
            <Tooltip>{p.title}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
      {tilesFailed && (
        <p role="status" className="absolute inset-x-2 bottom-8 z-[1000] rounded-md border bg-surface p-2 text-sm shadow">{tileErrorText}</p>
      )}
    </div>
  );
}

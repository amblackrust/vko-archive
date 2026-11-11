"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Branch } from "@/lib/api/branches";

// Область нажатия маркера не меньше 24 px (WCAG 2.5.8); видимый кружок меньше.
const HIT = 24;

// Свой маркер вместо картинок Leaflet по умолчанию (их пути ломаются в бандлере); цвета — токены темы.
function markerIcon(selected: boolean, head: boolean) {
  const size = selected ? 22 : head ? 18 : 14;
  return L.divIcon({
    className: "",
    iconSize: [HIT, HIT],
    iconAnchor: [HIT / 2, HIT / 2],
    html: `<span style="display:flex;width:${HIT}px;height:${HIT}px;align-items:center;justify-content:center"><span style="display:block;width:${size}px;height:${size}px;border-radius:50%;border:3px solid var(--primary-foreground);background:${
      selected ? "var(--accent)" : "var(--primary)"
    };box-shadow:0 0 0 1px var(--primary)"></span></span>`,
  });
}

function FitBounds({ branches, selected }: { branches: Branch[]; selected?: string }) {
  const map = useMap();
  useEffect(() => {
    const target = branches.find((b) => b.slug === selected);
    if (target?.lat != null && target.lng != null) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 9), { duration: 0.6 });
    } else if (branches.length > 0) {
      map.fitBounds(branches.map((b) => [b.lat!, b.lng!] as [number, number]), { padding: [30, 30], maxZoom: 9 });
    }
  }, [map, branches, selected]);
  return null;
}

interface BranchMapProps {
  branches: Branch[];
  selected?: string;
  onSelect?: (slug: string) => void;
  label: string;
  tileErrorText: string;
  className?: string;
}

export default function BranchMap({ branches, selected, onSelect, label, tileErrorText, className }: BranchMapProps) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const onMap = branches.filter((b) => b.show_on_map && b.lat != null && b.lng != null);
  return (
    <div className="relative h-full w-full">
    <MapContainer
      center={[49.2, 83.5]}
      zoom={7}
      scrollWheelZoom={false}
      className={`${className ?? ""} h-full w-full`}
      aria-label={label}
      style={{ background: "var(--surface-muted)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }}
      />
      <FitBounds branches={onMap} selected={selected} />
      {onMap.map((b) => (
        <Marker
          key={b.slug}
          position={[b.lat!, b.lng!]}
          icon={markerIcon(b.slug === selected, b.type === "head")}
          title={b.name}
          eventHandlers={{ click: () => onSelect?.(b.slug) }}
        >
          <Tooltip>{b.name}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
    {tilesFailed && (
      <p role="status" className="absolute inset-x-2 bottom-8 z-[1000] rounded-md border bg-surface p-2 text-sm shadow">
        {tileErrorText}
      </p>
    )}
    </div>
  );
}

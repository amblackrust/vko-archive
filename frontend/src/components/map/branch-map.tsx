"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Branch } from "@/lib/api/branches";

// Область нажатия маркера крупнее видимой точки (WCAG 2.5.8).
const HIT = 32;

/**
 * Свой маркер вместо картинок Leaflet (их пути ломаются в бандлере). Цвет — токен brand: он тёмный
 * в обеих темах, а подложка карты всегда светлая. Различия не только цветом: головной архив — квадрат,
 * выбранный филиал — крупнее и с золотой обводкой.
 */
function markerIcon(selected: boolean, head: boolean) {
  const size = selected ? 22 : head ? 16 : 14;
  return L.divIcon({
    className: "",
    iconSize: [HIT, HIT],
    iconAnchor: [HIT / 2, HIT / 2],
    html: `<span style="display:flex;width:${HIT}px;height:${HIT}px;align-items:center;justify-content:center"><span style="display:block;width:${size}px;height:${size}px;border-radius:${head ? "3px" : "50%"};border:2px solid var(--brand-foreground);background:var(--brand);box-shadow:0 0 0 ${selected ? "4px var(--gold)" : "1px var(--brand)"}"></span></span>`,
  });
}

function FitBounds({ points, selected }: { points: Branch[]; selected?: Branch }) {
  const map = useMap();
  useEffect(() => {
    if (selected) map.flyTo([selected.lat!, selected.lng!], Math.max(map.getZoom(), 10), { duration: 0.5 });
    else if (points.length > 0) map.fitBounds(points.map((b) => [b.lat!, b.lng!] as [number, number]), { padding: [36, 36], maxZoom: 11 });
  }, [map, points, selected]);
  return null;
}

interface BranchMapProps {
  branches: Branch[];
  selected?: string | null;
  onSelect?: (slug: string) => void;
  label: string;
  tileErrorText: string;
}

/** Карта подразделений архива. Список рядом с картой остаётся полноценной заменой: карта может не загрузиться. */
export default function BranchMap({ branches, selected, onSelect, label, tileErrorText }: BranchMapProps) {
  const [tilesFailed, setTilesFailed] = useState(false);
  // Стабильный ключ: без него подгонка границ срабатывала бы на каждую перерисовку родителя.
  const key = branches.map((b) => b.slug).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- состав точек описывает key
  const points = useMemo(() => branches.filter((b) => b.show_on_map && b.lat != null && b.lng != null), [key]);
  return (
    // isolate: слои Leaflet (z-index до 1000) не должны перекрывать липкую шапку сайта.
    <div role="region" aria-label={label} className="relative isolate h-full w-full">
      <MapContainer center={[49.2, 83.5]} zoom={7} scrollWheelZoom={false} className="h-full w-full" style={{ background: "var(--surface-muted)" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }}
        />
        <FitBounds points={points} selected={points.find((b) => b.slug === selected)} />
        {points.map((b) => (
          <Marker
            key={b.slug}
            position={[b.lat!, b.lng!]}
            icon={markerIcon(b.slug === selected, b.type === "head")}
            title={b.name}
            zIndexOffset={b.slug === selected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(b.slug) }}
          >
            <Tooltip>{b.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
      {tilesFailed && (
        <p role="status" className="absolute inset-x-3 bottom-8 z-[1000] rounded-md border border-border-strong bg-surface p-3 text-sm">
          {tileErrorText}
        </p>
      )}
    </div>
  );
}

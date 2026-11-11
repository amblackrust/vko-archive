"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { HistoricalEvent } from "@/lib/api/memory";

export type Place = HistoricalEvent & { lat: number; lng: number };

// Область нажатия маркера не меньше 24 px (WCAG 2.5.8); сам ромб меньше.
const HIT = 28;

/**
 * Исторические места — ромбы цвета «старой бумаги» на обесцвеченной подложке, выбранный крупнее и с широкой обводкой.
 * Карта филиалов — синие круги на цветной подложке: карты не спутать ни по маркерам, ни по фону.
 */
function placeIcon(selected: boolean) {
  const size = selected ? 20 : 14;
  return L.divIcon({
    className: "",
    iconSize: [HIT, HIT],
    iconAnchor: [HIT / 2, HIT / 2],
    html: `<span style="display:flex;width:${HIT}px;height:${HIT}px;align-items:center;justify-content:center"><span style="display:block;width:${size}px;height:${size}px;transform:rotate(45deg);background:var(--accent);border:2px solid #fff;box-shadow:0 0 0 ${selected ? 3 : 1}px var(--accent)"></span></span>`,
  });
}

function View({ places, selected }: { places: Place[]; selected?: string }) {
  const map = useMap();
  useEffect(() => {
    const target = places.find((place) => place.slug === selected);
    if (target) {
      const zoom = Math.max(map.getZoom(), 10);
      // Плавный «перелёт» — только если посетитель не просил уменьшить движение.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.setView([target.lat, target.lng], zoom);
      else map.flyTo([target.lat, target.lng], zoom, { duration: 0.6 });
    } else if (places.length > 0) {
      map.fitBounds(places.map((place) => [place.lat, place.lng] as [number, number]), { padding: [40, 40], maxZoom: 9 });
    }
  }, [map, places, selected]);
  return null;
}

export default function HistoryMap({ places, selected, onSelect, label, tileErrorText }: {
  places: Place[];
  selected?: string;
  onSelect: (slug: string) => void;
  label: string;
  tileErrorText: string;
}) {
  const [tilesFailed, setTilesFailed] = useState(false);
  return (
    // isolate: слои Leaflet (z-index до 1000) не должны перекрывать липкую шапку сайта.
    <div className="relative isolate h-full w-full">
      <MapContainer center={[49.9, 82.9]} zoom={7} scrollWheelZoom={false} aria-label={label} className="h-full w-full [&_.leaflet-tile-pane]:grayscale" style={{ background: "var(--surface-muted)" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }}
        />
        <View places={places} selected={selected} />
        {places.map((place) => (
          <Marker key={place.slug} position={[place.lat, place.lng]} icon={placeIcon(place.slug === selected)} title={place.title} eventHandlers={{ click: () => onSelect(place.slug) }}>
            <Tooltip>{place.title}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
      {tilesFailed && (
        <p role="status" className="absolute inset-x-3 top-3 z-[1000] rounded-md border border-border-strong bg-surface p-3 text-sm">{tileErrorText}</p>
      )}
    </div>
  );
}

"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

// Тот же маркер, что на публичной карте (область нажатия 24 px, WCAG 2.5.8): картинки Leaflet по умолчанию ломаются в бандлере.
const icon = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: '<span style="display:flex;width:24px;height:24px;align-items:center;justify-content:center"><span style="display:block;width:18px;height:18px;border-radius:50%;border:3px solid var(--primary-foreground);background:var(--accent);box-shadow:0 0 0 1px var(--primary)"></span></span>',
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

interface Props {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  label: string;
}

export default function CoordsPickerMap({ lat, lng, onPick, label }: Props) {
  const has = lat !== null && lng !== null;
  return (
    <MapContainer
      center={has ? [lat, lng] : [49.2, 83.5]}
      zoom={has ? 11 : 6}
      className="h-64 w-full rounded-md border"
      aria-label={label}
      style={{ background: "var(--surface-muted)" }}
    >
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler onPick={onPick} />
      {has && <Marker position={[lat, lng]} icon={icon} />}
    </MapContainer>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldGroup, TextField } from "../kit/form";

// Leaflet работает только в браузере.
const CoordsPickerMap = dynamic(() => import("./coords-picker-map"), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });

interface CoordsPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

/** Координаты филиала: клик по карте или ввод чисел. Широта и долгота задаются только вместе. */
export function CoordsPicker({ lat, lng, onChange }: CoordsPickerProps) {
  const t = useTranslations("adminCatalog.coords");
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const parse = (text: string) => (text === "" ? null : Number(text));
  return (
    <FieldGroup legend={t("title")} hint={t("hint")} className="sm:col-span-2">
      <CoordsPickerMap lat={lat} lng={lng} label={t("map")} onPick={(a, b) => onChange(round(a), round(b))} />
      <div className="grid grid-cols-2 gap-4">
        <TextField label={t("lat")} type="number" step="0.000001" min={-90} max={90} value={lat ?? ""} onChange={(event) => onChange(parse(event.target.value), lng)} />
        <TextField label={t("lng")} type="number" step="0.000001" min={-180} max={180} value={lng ?? ""} onChange={(event) => onChange(lat, parse(event.target.value))} />
      </div>
    </FieldGroup>
  );
}

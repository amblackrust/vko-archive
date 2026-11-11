"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "../form-field";

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
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t("title")}</legend>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      <CoordsPickerMap lat={lat} lng={lng} label={t("map")} onPick={(a, b) => onChange(round(a), round(b))} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("lat")} htmlFor="coords-lat">
          <Input id="coords-lat" type="number" step="0.000001" min={-90} max={90} value={lat ?? ""} onChange={(e) => onChange(parse(e.target.value), lng)} />
        </FormField>
        <FormField label={t("lng")} htmlFor="coords-lng">
          <Input id="coords-lng" type="number" step="0.000001" min={-180} max={180} value={lng ?? ""} onChange={(e) => onChange(lat, parse(e.target.value))} />
        </FormField>
      </div>
    </fieldset>
  );
}

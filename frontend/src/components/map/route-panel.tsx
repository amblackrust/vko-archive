"use client";

import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { MapLinks } from "./map-links";
import { distanceKm, mapQuery, type LatLng, type TravelMode } from "./route-links";

const MODES: TravelMode[] = ["car", "walk", "transit", "bike"];

interface Origin extends LatLng {
  /** Найденный геокодером адрес; null — точка получена геолокацией. */
  label: string | null;
}

/**
 * Маршрут до подразделения. Ссылки на внешние карты работают сразу и всегда; точка отправления —
 * по желанию: геолокация только по нажатию кнопки, при отказе — адрес вручную (геокодер Nominatim).
 * Сбой геолокации или геокодера оставляет адрес, контакты и ссылки на месте.
 */
export function RoutePanel({ address, point, verified, heading: Heading = "h2" }: {
  address: string;
  /** Точка подразделения на карте; null — координат нет. */
  point: LatLng | null;
  /** Координаты подтверждены архивом: тогда маршрут строится к ним, иначе — к текстовому адресу. */
  verified: boolean;
  heading?: "h2" | "h3";
}) {
  const t = useTranslations("map.route");
  const [mode, setMode] = useState<TravelMode>("car");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");

  // После сбоя фокус уходит в поле адреса: это следующий шаг, который остаётся посетителю.
  function fail(message: string) {
    setError(message);
    setBusy(false);
    document.getElementById("route-from")?.focus();
  }

  function locate() {
    setError(null);
    if (!navigator.geolocation) return fail(t("geoUnavailable"));
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude, label: null });
        setBusy(false);
      },
      (reason) => fail(reason.code === reason.PERMISSION_DENIED ? t("geoDenied") : t("geoUnavailable")),
      { timeout: 10000 },
    );
  }

  async function geocode(event: React.FormEvent) {
    event.preventDefault();
    const query = from.trim();
    if (!query) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(8000),
      });
      const found = (await response.json()) as { lat: string; lon: string; display_name?: string }[];
      if (!response.ok || found.length === 0) throw new Error("not found");
      setOrigin({ lat: Number(found[0].lat), lng: Number(found[0].lon), label: found[0].display_name ?? query });
      setBusy(false);
    } catch {
      fail(t("geocodeFailed"));
    }
  }

  const km = origin && point ? Math.round(distanceKm(origin, point)) : null;
  return (
    <section aria-labelledby="route-title" className="space-y-4">
      <div className="space-y-1">
        <Heading id="route-title" className={Heading === "h2" ? "text-2xl" : "text-lg"}>{t("title")}</Heading>
        <p className="text-sm text-muted-foreground">{t("text")}</p>
      </div>

      <div className="space-y-3 card p-4">
        <Button type="button" variant="outline" className="h-11 w-full whitespace-normal sm:w-auto" onClick={locate} disabled={busy}>
          <LocateFixed aria-hidden /> {t("useLocation")}
        </Button>
        <form onSubmit={geocode} className="flex items-end gap-2">
          <Field id="route-from" label={t("addressLabel")} placeholder={t("addressPlaceholder")} maxLength={200} value={from} onChange={(event) => setFrom(event.target.value)} className="min-w-0 flex-1" />
          <Button type="submit" variant="outline" className="h-11" disabled={busy}>{t("find")}</Button>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {origin && (
          <p role="status" className="text-sm">
            {origin.label ? t("originAddress", { address: origin.label }) : t("originLocation")}{" "}
            {km != null && t(verified ? "distance" : "distanceApprox", { km })}
          </p>
        )}
      </div>

      <SelectField label={t("mode")} value={mode} onChange={(event) => setMode(event.target.value as TravelMode)} options={MODES.map((value) => ({ value, label: t(`modes.${value}`) }))} className="max-w-xs" />
      <MapLinks destination={verified && point ? `${point.lat},${point.lng}` : mapQuery(address)} mode={mode} origin={origin} />
      <p className="text-sm text-muted-foreground">{t("modeNote")}</p>
    </section>
  );
}

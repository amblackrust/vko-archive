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
export function RoutePanel({ address, point, verified }: {
  address: string;
  /** Точка подразделения на карте; null — координат нет. */
  point: LatLng | null;
  /** Координаты подтверждены архивом: тогда маршрут строится к ним, иначе — к текстовому адресу. */
  verified: boolean;
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
    <section aria-labelledby="route-title">
      <h2 id="route-title" className="text-2xl sm:text-3xl">{t("title")}</h2>
      <div className="card mt-6 grid gap-x-10 gap-y-8 p-6 sm:p-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-[1.0625rem]">{t("fromTitle")}</h3>
          <form onSubmit={geocode} className="flex items-end gap-2">
            <Field id="route-from" label={t("addressLabel")} placeholder={t("addressPlaceholder")} maxLength={200} value={from} onChange={(event) => setFrom(event.target.value)} className="min-w-0 flex-1" />
            <Button type="submit" variant="soft" className="h-11" disabled={busy}>{t("find")}</Button>
          </form>
          <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2 sm:w-auto" onClick={locate} disabled={busy}>
            <LocateFixed aria-hidden /> {t("useLocation")}
          </Button>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          {origin && (
            <p role="status" className="rounded-md bg-primary-soft px-4 py-3 text-[0.9375rem]">
              {origin.label ? t("originAddress", { address: origin.label }) : t("originLocation")}{" "}
              {km != null && t(verified ? "distance" : "distanceApprox", { km })}
            </p>
          )}
        </div>
        <div className="space-y-4 lg:border-l lg:pl-10">
          <h3 className="text-[1.0625rem]">{t("openTitle")}</h3>
          <SelectField label={t("mode")} value={mode} onChange={(event) => setMode(event.target.value as TravelMode)} options={MODES.map((value) => ({ value, label: t(`modes.${value}`) }))} />
          <MapLinks destination={verified && point ? `${point.lat},${point.lng}` : mapQuery(address)} mode={mode} origin={origin} />
        </div>
      </div>
    </section>
  );
}

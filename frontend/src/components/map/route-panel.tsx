"use client";

import { ExternalLink, LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { distanceKm, externalMapLinks, type LatLng, type TravelMode } from "./external-links";

const modes: TravelMode[] = ["car", "walk", "transit", "bike"];

/**
 * Внешние ссылки на 2GIS / Google Maps / Яндекс всегда доступны. Построение маршрута из
 * точки отправления — по желанию: геолокация только по явной кнопке, либо адрес (Nominatim).
 * Любой сбой оставляет только ссылки и адрес.
 */
export function RoutePanel({ address, destination }: { address: string; destination: LatLng | null }) {
  const t = useTranslations("map.route");
  const [mode, setMode] = useState<TravelMode>("car");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const links = externalMapLinks(address, mode, origin);

  function locate() {
    setError(null);
    if (!navigator.geolocation) {
      setError(t("geoUnavailable"));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBusy(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? t("geoDenied") : t("geoUnavailable"));
        setBusy(false);
      },
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      const found = (await response.json()) as { lat: string; lon: string }[];
      if (!response.ok || found.length === 0) throw new Error("not found");
      setOrigin({ lat: Number(found[0].lat), lng: Number(found[0].lon) });
    } catch {
      setError(t("geocodeFailed"));
    } finally {
      setBusy(false);
    }
  }

  const km = origin && destination ? distanceKm(origin, destination) : null;
  const linkClass = "inline-flex min-h-9 items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted";
  return (
    <section aria-label={t("title")} className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <div className="space-y-2">
        <Button type="button" variant="outline" size="sm" onClick={locate} disabled={busy}>
          <LocateFixed aria-hidden /> {t("useLocation")}
        </Button>
        <form onSubmit={geocode} className="flex gap-2">
          <label htmlFor="route-from" className="sr-only">{t("addressLabel")}</label>
          <Input id="route-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("addressPlaceholder")} maxLength={200} />
          <Button type="submit" variant="outline" size="sm" disabled={busy || !from.trim()}>{t("find")}</Button>
        </form>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {origin && (
        <p className="text-sm" role="status">
          {km != null ? t("distance", { km: Math.round(km) }) : t("originSet")}
        </p>
      )}
      <div className="space-y-2">
        <label htmlFor="route-mode" className="block text-sm text-muted-foreground">{t("mode")}</label>
        <select
          id="route-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as TravelMode)}
          className="h-10 w-full rounded-md border bg-surface px-3 text-sm"
        >
          {modes.map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
        </select>
      </div>
      <ul className="flex flex-wrap gap-2">
        {([["twoGis", links.twoGis], ["google", links.google], ["yandex", links.yandex]] as const).map(([id, href]) => (
          <li key={id}>
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {t(`open.${id}`)} <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">({t("external")})</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

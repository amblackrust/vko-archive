export type TravelMode = "car" | "walk" | "transit" | "bike";
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Ссылки во внешние карты. Пункт назначения передаём адресом, а не координатами: координаты
 * филиалов приблизительные (coords_verified=false). Начало маршрута — только если посетитель
 * сам разрешил геолокацию или ввёл адрес.
 */
const googleMode: Record<TravelMode, string> = { car: "driving", walk: "walking", transit: "transit", bike: "bicycling" };
const yandexMode: Record<TravelMode, string> = { car: "auto", walk: "pd", transit: "mt", bike: "bc" };

export function externalMapLinks(address: string, mode: TravelMode, origin?: LatLng | null) {
  const destination = encodeURIComponent(address);
  const from = origin ? `${origin.lat},${origin.lng}` : "";
  return {
    twoGis: `https://2gis.kz/search/${destination}`,
    google: origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${from}&destination=${destination}&travelmode=${googleMode[mode]}`
      : `https://www.google.com/maps/search/?api=1&query=${destination}`,
    yandex: origin
      ? `https://yandex.kz/maps/?rtext=${from}~${destination}&rtt=${yandexMode[mode]}`
      : `https://yandex.kz/maps/?text=${destination}`,
  };
}

/** Расстояние по прямой, км (формула гаверсинусов). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export type TravelMode = "car" | "walk" | "transit" | "bike";
export interface LatLng {
  lat: number;
  lng: number;
}

const googleMode: Record<TravelMode, string> = { car: "driving", walk: "walking", transit: "transit", bike: "bicycling" };
const yandexMode: Record<TravelMode, string> = { car: "auto", walk: "pd", transit: "mt", bike: "bc" };

/** Адреса филиалов в данных архива начинаются с «ВКО»: внешним картам понятнее полное название области. */
export const mapQuery = (address: string) => address.replace(/^ВКО(?=[,\s])/, "Восточно-Казахстанская область");

/**
 * Ссылки во внешние карты. Пункт назначения — адрес (или точные координаты, если их подтвердил архив).
 * Без точки отправления Google и Яндекс сами предложат начать от текущего места; 2GIS открывает адрес.
 */
export function routeLinks(destination: string, mode: TravelMode, origin?: LatLng | null) {
  const to = encodeURIComponent(destination);
  const from = origin ? `${origin.lat},${origin.lng}` : "";
  return [
    { id: "twoGis", href: `https://2gis.kz/search/${to}` },
    { id: "google", href: `https://www.google.com/maps/dir/?api=1${from && `&origin=${from}`}&destination=${to}&travelmode=${googleMode[mode]}` },
    { id: "yandex", href: `https://yandex.kz/maps/?rtext=${from}~${to}&rtt=${yandexMode[mode]}` },
  ] as const;
}

/** Расстояние по прямой, км (формула гаверсинусов). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

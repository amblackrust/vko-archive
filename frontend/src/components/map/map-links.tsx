import { useTranslations } from "next-intl";
import { ExternalLink } from "@/components/ui/external-link";
import { routeLinks, type LatLng, type TravelMode } from "./route-links";

/** Переходы в 2GIS, Google Maps и Яндекс Карты: работают без карты сайта, геолокации и геокодера. */
export function MapLinks({ destination, mode = "car", origin }: { destination: string; mode?: TravelMode; origin?: LatLng | null }) {
  const t = useTranslations("map.route.open");
  return (
    <ul className="flex flex-wrap gap-2">
      {routeLinks(destination, mode, origin).map(({ id, href }) => (
        <li key={id}>
          <ExternalLink href={href} className="min-h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold hover:border-primary hover:no-underline [&_svg]:mt-0">
            {t(id)}
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}

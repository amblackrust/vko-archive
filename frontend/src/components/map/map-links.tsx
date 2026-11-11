import { useTranslations } from "next-intl";
import { ExternalLink } from "@/components/ui/external-link";
import { cn } from "@/lib/utils";
import { routeLinks, type LatLng, type TravelMode } from "./route-links";

/** Переходы в 2GIS, Google Maps и Яндекс Карты: работают без карты сайта, геолокации и геокодера. */
export function MapLinks({ destination, mode = "car", origin, className }: { destination: string; mode?: TravelMode; origin?: LatLng | null; className?: string }) {
  const t = useTranslations("map.route.open");
  return (
    <ul className={cn("grid gap-2", className)}>
      {routeLinks(destination, mode, origin).map(({ id, href }) => (
        <li key={id}>
          <ExternalLink
            href={href}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md border bg-surface px-4 py-2 text-[0.9375rem] font-semibold transition-colors hover:border-primary hover:no-underline [&_svg]:mt-0"
          >
            {t(id)}
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}

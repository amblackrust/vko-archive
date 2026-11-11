import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Фото-плитки разделов. Снимки лежат в public/img/home; автор и лицензия каждого показаны в строке под сеткой
 * (полные сведения — backend/seed/media/commons/manifest.json).
 */
const tiles = [
  { id: "history", href: "/memory", image: "history", author: "Coopypasted", license: "CC BY-SA 4.0", wide: true },
  { id: "catalog", href: "/catalog", image: "catalog", author: "ЦСК МВД, 1893", license: "Public domain" },
  { id: "exhibitions", href: "/exhibitions", image: "exhibitions", author: "G. Kennan, 1891", license: "Public domain" },
  { id: "people", href: "/memory#persons", image: "people", author: "С. И. Борисов, 1911–1914", license: "Public domain" },
  { id: "branches", href: "/branches", image: "branches", author: "Richter75", license: "CC BY-SA 4.0" },
  { id: "timeline", href: "/memory/timeline", image: "city", author: "Andriej Szypiłow", license: "CC BY-SA 3.0", wide: true },
] as const;

export function SectionTiles() {
  const t = useTranslations("home.tiles");
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.id} className={cn("wide" in tile && tile.wide && "lg:col-span-2")}>
            <Link href={tile.href} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-surface-muted lg:aspect-auto lg:h-64">
              <Image src={`/img/home/${tile.image}.jpg`} alt="" fill sizes="(min-width: 1024px) 50vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#152040]/85 via-[#152040]/10 to-transparent" aria-hidden />
              <span className="absolute left-4 top-4 rounded-full bg-[#3247d3] px-3.5 py-1.5 text-sm font-semibold text-white">{t(`${tile.id}.label`)}</span>
              <span className="absolute inset-x-4 bottom-4 text-lg font-semibold leading-snug text-white">{t(`${tile.id}.title`)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("credits")} {tiles.map((tile) => `${tile.author} (${tile.license})`).join("; ")}.
      </p>
    </>
  );
}

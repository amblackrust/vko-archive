import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { fileUrl } from "@/lib/api/document";
import type { ExhibitionItem } from "./api";
import { ThemeLabel } from "./theme-label";

/** Карточка выставки в списке: обложка (только открытая копия), тема, период, число экспонатов. */
export function ExhibitionCard({ exhibition, locale }: { exhibition: ExhibitionItem; locale: string }) {
  const t = useTranslations("exhibitions.card");
  const cover = exhibition.cover?.preview_url ?? exhibition.cover?.url;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border bg-surface">
      <div className="flex aspect-[16/9] items-center justify-center bg-surface-muted text-muted-foreground">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
          <img src={fileUrl(cover)} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm">
            <ImageOff className="size-6" aria-hidden />
            {t("noCover")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-lg font-semibold" lang={exhibition.title_lang}>
          <Link href={`/exhibitions/${exhibition.slug}`} className="hover:underline">
            {exhibition.title}
          </Link>
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {exhibition.theme && <ThemeLabel theme={exhibition.theme} />}
          {exhibition.period && <span>{exhibition.period}</span>}
          <span>{t("exhibits", { count: exhibition.exhibits_count })}</span>
          {exhibition.title_lang !== locale && <DemoBadge kind="noTranslation" />}
        </p>
        <p className="line-clamp-3 text-sm" lang={exhibition.title_lang}>{exhibition.intro}</p>
      </div>
    </article>
  );
}

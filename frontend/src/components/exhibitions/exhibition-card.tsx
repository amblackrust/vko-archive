import { useTranslations } from "next-intl";
import { themeLabel } from "@/components/memory/labels";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { fileUrl } from "@/lib/api/document";
import { Link } from "@/lib/i18n/navigation";
import { thumbPath, type ExhibitionItem } from "./api";
import { MediaImage } from "./media-image";

/** Карточка выставки: обложка (только открытая копия), тема, период, число экспонатов. `heading` — уровень заголовка. */
export function ExhibitionCard({ exhibition, locale, heading: Heading = "h2" }: {
  exhibition: ExhibitionItem;
  locale: string;
  heading?: "h2" | "h3";
}) {
  const t = useTranslations("exhibitions");
  const cover = thumbPath(exhibition.cover);
  return (
    <article className="card lift group relative flex h-full flex-col overflow-hidden">
      <MediaImage src={cover && fileUrl(cover)} alt="" fallback={t("card.noCover")} className="aspect-[4/3] rounded-none border-0" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {exhibition.theme && <span>{themeLabel(t, "themes", exhibition.theme)}</span>}
          {exhibition.period && <span>{exhibition.period}</span>}
          {exhibition.is_demo && <DemoTag />}
          {exhibition.title_lang !== locale && <DemoBadge kind="noTranslation" />}
        </p>
        <Heading className="text-xl" lang={exhibition.title_lang}>
          {/* Ссылка растянута на всю карточку: обложка тоже нажимается. */}
          <Link href={`/exhibitions/${exhibition.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{exhibition.title}</Link>
        </Heading>
        <p className="line-clamp-3 text-sm text-muted-foreground" lang={exhibition.title_lang}>{exhibition.intro}</p>
        <p className="mt-auto pt-2">
          <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">{t("card.exhibits", { count: exhibition.exhibits_count })}</span>
        </p>
      </div>
    </article>
  );
}

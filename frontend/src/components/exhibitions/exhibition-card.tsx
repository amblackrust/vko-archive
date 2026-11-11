import { useTranslations } from "next-intl";
import { themeLabel } from "@/components/memory/labels";
import { fileUrl } from "@/lib/api/document";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { thumbPath, type ExhibitionItem } from "./api";

/**
 * Карточка выставки: обложка (только открытая копия), тема, период, название, начало вступления и число экспонатов.
 * `large` — крупная карточка списка выставок; `heading` — уровень заголовка. Без обложки карточка остаётся текстовой.
 */
export function ExhibitionCard({ exhibition, heading: Heading = "h2", large }: {
  exhibition: ExhibitionItem;
  heading?: "h2" | "h3";
  large?: boolean;
}) {
  const t = useTranslations("exhibitions");
  const cover = thumbPath(exhibition.cover);
  return (
    <article className="card lift group relative flex h-full flex-col overflow-hidden">
      {cover && (
        <div className={cn("overflow-hidden bg-surface-muted", large ? "aspect-[16/9]" : "aspect-[4/3]")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав */}
          <img src={fileUrl(cover)} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
      )}
      <div className={cn("flex flex-1 flex-col", large ? "p-6 sm:p-7" : "p-5")}>
        {exhibition.theme && <p className="mb-1.5 truncate text-sm text-muted-foreground">{themeLabel(t, "themes", exhibition.theme)}</p>}
        <Heading className={cn("leading-snug [text-wrap:pretty]", large ? "text-xl sm:text-2xl" : "text-[1.0625rem] sm:text-lg")} lang={exhibition.title_lang}>
          {/* Ссылка растянута на всю карточку: обложка тоже нажимается. */}
          <Link href={`/exhibitions/${exhibition.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{exhibition.title}</Link>
        </Heading>
        {exhibition.intro && (
          <p className={cn("mt-2 line-clamp-3 text-muted-foreground", !large && "text-[0.9375rem]")} lang={exhibition.title_lang}>{exhibition.intro}</p>
        )}
        <p className="mt-auto flex items-baseline justify-between gap-x-3 pt-4 text-sm tabular-nums">
          <span className="shrink-0 font-semibold">{t("card.exhibits", { count: exhibition.exhibits_count })}</span>
          {exhibition.period && <span className="truncate text-muted-foreground" title={exhibition.period}>{exhibition.period}</span>}
        </p>
      </div>
    </article>
  );
}

import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { fileUrl } from "@/lib/api/document";
import { Link } from "@/lib/i18n/navigation";
import { formatPublished, type NewsItem } from "./api";

export function NewsCard({ item, locale }: { item: NewsItem; locale: string }) {
  const t = useTranslations("news");
  const date = formatPublished(item.published_at, locale);
  const cover = item.cover?.preview_url ?? item.cover?.url;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border bg-surface">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
        <img src={fileUrl(cover)} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {date ? <time dateTime={item.published_at ?? undefined}>{date}</time> : <span>{t("card.noDate")}</span>}
          {item.category && <span>{t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}</span>}
          {item.is_demo && <DemoBadge />}
          {item.title_lang !== locale && <DemoBadge kind="noTranslation" />}
        </p>
        <h2 className="text-lg font-semibold" lang={item.title_lang}>
          <Link href={`/news/${item.slug}`} className="hover:underline">{item.title}</Link>
        </h2>
        <p className="line-clamp-3 text-sm" lang={item.title_lang}>{item.summary}</p>
      </div>
    </article>
  );
}

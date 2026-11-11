import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { fileUrl } from "@/lib/api/document";
import { formatIsoDate } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";
import type { NewsItem } from "./api";

/** Строка ленты новостей: дата, заголовок-ссылка, анонс, пометки и необязательная обложка. */
export function NewsRow({ item, locale }: { item: NewsItem; locale: string }) {
  const t = useTranslations("news");
  const date = formatIsoDate(item.published_at, locale);
  const cover = item.cover?.preview_url ?? item.cover?.url;
  return (
    <li className="grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
      <p className="text-sm text-muted-foreground sm:pt-1">
        {date ? <time dateTime={item.published_at ?? undefined}>{date}</time> : t("noDate")}
      </p>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-snug" lang={item.title_lang}>
          <Link href={`/news/${item.slug}`} className="hover:text-primary hover:underline">{item.title}</Link>
        </h2>
        {item.summary && <p className="mt-1 line-clamp-3 max-w-3xl text-[0.9375rem] text-muted-foreground" lang={item.title_lang}>{item.summary}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {item.category && <span>{t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}</span>}
          {item.is_demo && <DemoTag />}
          {item.title_lang !== locale && <DemoBadge kind="noTranslation" />}
        </p>
      </div>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
        <img src={fileUrl(cover)} alt="" loading="lazy" className="h-24 w-36 rounded-md object-cover" />
      )}
    </li>
  );
}

import { useTranslations } from "next-intl";
import { fileUrl } from "@/lib/api/document";
import { formatIsoDate } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { NewsItem } from "./api";

/**
 * Карточка ленты новостей: обложка слева (если она есть), категория и дата, заголовок-ссылка, анонс.
 * Новость без обложки — та же карточка без картинки, текст занимает всю ширину.
 * `lead` — главная карточка над сеткой: обложка крупно, заголовок больше.
 */
export function NewsCard({ item, locale, lead }: { item: NewsItem; locale: string; lead?: boolean }) {
  const t = useTranslations("news");
  const date = formatIsoDate(item.published_at, locale);
  const cover = lead ? (item.cover?.url ?? item.cover?.preview_url) : (item.cover?.preview_url ?? item.cover?.url);
  return (
    <article className={cn("card lift group relative flex h-full flex-col overflow-hidden", lead ? "rounded-3xl lg:flex-row" : "sm:flex-row")}>
      {cover && (
        <div className={cn("relative shrink-0 bg-surface-muted", "aspect-[16/9]", lead ? "lg:aspect-auto lg:min-h-80 lg:w-1/2" : "sm:aspect-auto sm:w-44")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав */}
          <img src={fileUrl(cover)} alt="" loading={lead ? undefined : "lazy"} className="absolute inset-0 size-full object-cover" />
        </div>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col p-5", lead && "justify-center sm:p-10")}>
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          {item.category && <span className="font-semibold text-primary">{t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}</span>}
          {date && <time dateTime={item.published_at ?? undefined} className="text-muted-foreground">{date}</time>}
        </p>
        <h2 className={cn("mt-2 font-semibold leading-snug [text-wrap:pretty]", lead ? "text-2xl sm:text-3xl" : "text-[1.0625rem]")} lang={item.title_lang}>
          <Link href={`/news/${item.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{item.title}</Link>
        </h2>
        {item.summary && <p className={cn("text-muted-foreground", lead ? "mt-3 text-lg" : "mt-1.5 line-clamp-3 text-[0.9375rem]")} lang={item.title_lang}>{item.summary}</p>}
      </div>
    </article>
  );
}

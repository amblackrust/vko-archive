import { useTranslations } from "next-intl";
import { fileUrl } from "@/lib/api/document";
import type { CollectionItem } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { themeLabel } from "./labels";

/**
 * Коллекция плиткой: обложка — изображение первого документа с открытой копией, под ней тема, период, название, начало описания и объём.
 * На телефоне плитки идут в две колонки и показывают только обложку, название и объём.
 * Без обложки плитка остаётся типографской: крупное название и развёрнутое описание, пустой плашки нет.
 */
export function CollectionCard({ collection, cover, heading: Heading = "h3" }: {
  collection: CollectionItem;
  /** Путь превью из API (/api/files/…); null — обложки нет. */
  cover?: string | null;
  heading?: "h2" | "h3";
}) {
  const t = useTranslations("memory");
  return (
    <article className="card lift group relative flex h-full flex-col overflow-hidden">
      {cover && (
        <div className="aspect-[4/3] overflow-hidden bg-surface-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав */}
          <img src={fileUrl(cover)} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        {(collection.theme || collection.period) && (
          <p className="mb-1.5 hidden gap-x-3 text-sm text-muted-foreground sm:flex">
            {collection.theme && <span className="truncate">{themeLabel(t, "themes", collection.theme)}</span>}
            {collection.period && <span className="shrink-0 tabular-nums">{collection.period}</span>}
          </p>
        )}
        <Heading className={cn("font-semibold leading-snug [text-wrap:pretty]", cover ? "line-clamp-4 text-[0.9375rem] sm:line-clamp-none sm:text-[1.0625rem]" : "text-xl")} lang={collection.title_lang}>
          {/* Ссылка растянута на всю плитку: обложка тоже нажимается. */}
          <Link href={collection.href} className="after:absolute after:inset-0 group-hover:text-primary">{collection.title}</Link>
        </Heading>
        {collection.description && (
          <p className={cn("mt-2 text-[0.9375rem] text-muted-foreground", cover ? "hidden sm:line-clamp-3" : "line-clamp-[9]")} lang={collection.title_lang}>{collection.description}</p>
        )}
        <p className="mt-auto pt-3 text-sm font-semibold tabular-nums sm:pt-4">{t("collections.items", { count: collection.item_count })}</p>
      </div>
    </article>
  );
}

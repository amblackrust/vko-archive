import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { RecommendationItem } from "./api";

/** Список рекомендаций: названия и описания — plain text, ссылки — `href` с сервера. */
export function RecommendationList({ items }: { items: RecommendationItem[] }) {
  const t = useTranslations("aiDocument.recommendations");
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <article className="h-full rounded-lg border bg-surface p-4">
            <p className="text-xs uppercase text-muted-foreground">{t(`types.${item.type}`)}</p>
            <h3 className="mt-1 font-semibold leading-snug">
              <Link href={item.href} className="break-words hover:underline" lang={item.title_lang}>{item.title}</Link>
            </h3>
            {item.document && (item.document.archive_code || item.document.date_text) && (
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {[item.document.archive_code, item.document.date_text].filter(Boolean).join(" · ")}
              </p>
            )}
            {item.summary && <p className="mt-2 line-clamp-3 text-sm">{item.summary}</p>}
          </article>
        </li>
      ))}
    </ul>
  );
}

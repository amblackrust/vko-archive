import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DocumentItem } from "@/lib/api/catalog";
import { fileUrl } from "@/lib/api/document";
import { Link } from "@/lib/i18n/navigation";
import { AccessBadge } from "./access-badge";
import { enumLabel } from "./labels";

/** Документ плиткой: изображение, шифр, название, дата и вид. Вся плитка — одна ссылка (растянута от заголовка). */
export function DocumentCard({ item }: { item: DocumentItem }) {
  const t = useTranslations("catalog");
  const foreign = item.title_lang !== useLocale();
  return (
    <li className="card lift group relative flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] bg-surface-muted">
        {item.preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
          <img src={fileUrl(item.preview_url)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted-foreground" aria-hidden><FileText className="size-8" /></span>
        )}
        {item.file_access !== "open" && (
          <span className="absolute left-3 top-3 rounded-full bg-surface px-3 py-1 shadow-card"><AccessBadge access={item.file_access} className="text-xs" /></span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="cipher flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
          {item.archive_code ?? "—"}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-[1.0625rem] font-semibold leading-snug" lang={foreign ? item.title_lang : undefined}>
          <Link href={item.href} className="after:absolute after:inset-0 group-hover:text-primary">{item.title}</Link>
        </h3>
        <p className="mt-auto flex flex-wrap gap-x-3 pt-3 text-sm text-muted-foreground">
          {item.date_text && <span>{item.date_text}</span>}
          {item.doc_type && <span>{enumLabel(t, "docTypes", item.doc_type)}</span>}
        </p>
      </div>
    </li>
  );
}

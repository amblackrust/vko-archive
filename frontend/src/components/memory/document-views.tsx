import { FileImage } from "lucide-react";
import { useTranslations } from "next-intl";
import { DocumentCard } from "@/components/catalog/document-card";
import { Link } from "@/lib/i18n/navigation";
import { fileUrl } from "@/lib/api/document";
import type { MemoryDocument } from "@/lib/api/memory";

/** Документ списком: карточка каталога + заметка редактора коллекции. */
export function DocumentList({ items }: { items: MemoryDocument[] }) {
  const t = useTranslations("memory.collection");
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="space-y-2">
          <DocumentCard item={item} />
          {item.note && (
            <p className="px-1 text-sm text-muted-foreground"><strong className="text-foreground">{t("note")}:</strong> {item.note}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Галерея: превью открытых цифровых копий; закрытые файлы превью не имеют (решает сервер). */
export function DocumentGallery({ items }: { items: MemoryDocument[] }) {
  const t = useTranslations("memory.collection");
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-lg border bg-surface">
          <Link href={item.href} className="block hover:opacity-90">
            <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted">
              {item.preview_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                <img src={fileUrl(item.preview_url)} alt={item.title} loading="lazy" className="size-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-muted-foreground">
                  <FileImage className="size-6" aria-hidden />
                  {t("noPreview")}
                </span>
              )}
            </div>
            <div className="space-y-1 p-3">
              <h3 className="text-sm font-semibold leading-snug" lang={item.title_lang}>{item.title}</h3>
              <p className="text-xs text-muted-foreground">{[item.date_text, item.archive_code].filter(Boolean).join(" · ")}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

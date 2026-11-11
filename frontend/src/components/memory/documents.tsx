import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { fileUrl } from "@/lib/api/document";
import type { MemoryDocument } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { evenGrid, TILE_COLS } from "./grid";
import { themeLabel } from "./labels";
import { EditorialNote } from "./provenance";

/** Реквизиты документа одной строкой: дата и вид словами каталога («Фотография», «Решение»). */
function Requisites({ item }: { item: MemoryDocument }) {
  const t = useTranslations("catalog");
  return (
    <>
      {item.date_text && <span>{item.date_text}</span>}
      {item.doc_type && <span>{themeLabel(t, "docTypes", item.doc_type)}</span>}
    </>
  );
}

/** Документы списком: строка с миниатюрой, шифром и реквизитами ведёт в карточку каталога. */
export function DocumentRows({ items }: { items: MemoryDocument[] }) {
  const t = useTranslations("memory.documents");
  return (
    <RecordList>
      {items.map((item) => (
        <RecordRow
          key={item.id}
          code={item.archive_code ?? "—"}
          thumb={item.preview_url ? fileUrl(item.preview_url) : null}
          title={item.title}
          href={item.href}
          lang={item.title_lang}
          meta={
            <>
              <Requisites item={item} />
              {item.authors && <span>{item.authors}</span>}
              {item.fund && <span>{t("fund", { number: item.fund.number })}</span>}
            </>
          }
        >
          {item.note && <EditorialNote>{item.note}</EditorialNote>}
        </RecordRow>
      ))}
    </RecordList>
  );
}

/**
 * Документы плиткой: изображение открытой копии, шифр, название, дата, вид и автор снимка или рисунка.
 * Число колонок подбирается так, чтобы последний ряд был полным; `closing` закрывает ряд плиткой-переходом.
 */
export function DocumentTiles({ items, closing }: { items: MemoryDocument[]; closing?: React.ReactNode }) {
  const grid = evenGrid(items.length);
  return (
    <ul className={cn("grid auto-rows-fr gap-3 sm:gap-4", TILE_COLS[grid.cols])}>
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <article className="card lift group relative flex h-full flex-col overflow-hidden">
            <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
              {item.preview_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                <img src={fileUrl(item.preview_url)} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-muted-foreground" aria-hidden><FileText className="size-8" /></span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-3 sm:p-4">
              {item.archive_code && <p className="cipher text-xs font-semibold text-primary sm:text-sm">{item.archive_code}</p>}
              <h3 className="mt-1.5 line-clamp-3 break-words text-[0.9375rem] font-semibold leading-snug sm:text-[1.0625rem]" lang={item.title_lang}>
                {/* Ссылка растянута на всю плитку: изображение тоже нажимается. */}
                <Link href={item.href} className="after:absolute after:inset-0 group-hover:text-primary">{item.title}</Link>
              </h3>
              {item.note && <EditorialNote>{item.note}</EditorialNote>}
              <div className="mt-auto pt-3 text-sm text-muted-foreground">
                <p className="flex flex-wrap gap-x-3"><Requisites item={item} /></p>
                {item.authors && <p className="mt-0.5 line-clamp-1">{item.authors}</p>}
              </div>
            </div>
          </article>
        </li>
      ))}
      {grid.closing && closing && <li className="min-w-0">{closing}</li>}
    </ul>
  );
}

/**
 * Документы внутри события или места на карте: небольшие изображения с названием и шифром.
 * Сетка следит за шириной своего блока (узкая панель карты — две колонки, лента хронологии — четыре).
 */
export function DocumentThumbs({ items }: { items: MemoryDocument[] }) {
  return (
    <div className="@container">
      <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @2xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <Link href={item.href} className="group block">
              {item.preview_url && (
                // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                <img src={fileUrl(item.preview_url)} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-md bg-surface-muted object-cover" />
              )}
              <span className={cn("line-clamp-2 break-words text-sm font-medium leading-snug group-hover:text-primary group-hover:underline", item.preview_url && "mt-1.5")} lang={item.title_lang}>{item.title}</span>
              {item.archive_code && <span className="cipher mt-0.5 block text-xs text-muted-foreground">{item.archive_code}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

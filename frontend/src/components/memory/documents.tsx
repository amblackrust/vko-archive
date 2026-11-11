import { useTranslations } from "next-intl";
import { MediaImage } from "@/components/exhibitions/media-image";
import { DemoTag } from "@/components/ui/demo-tag";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { fileUrl } from "@/lib/api/document";
import type { MemoryDocument } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { themeLabel } from "./labels";
import { EditorialNote } from "./provenance";

/** Реквизиты документа одной строкой: дата, вид словами каталога («Фотография», «Решение»), автор. */
function Requisites({ item }: { item: MemoryDocument }) {
  const t = useTranslations("catalog");
  return (
    <>
      {item.date_text && <span>{item.date_text}</span>}
      {item.doc_type && <span>{themeLabel(t, "docTypes", item.doc_type)}</span>}
      {item.authors && <span>{item.authors}</span>}
    </>
  );
}

/**
 * Документы списком: строка ведёт в карточку каталога. `nested` — список внутри другой карточки (событие, место на карте):
 * без тени и миниатюр, шифр уходит в строку реквизитов.
 */
export function DocumentRows({ items, nested }: { items: MemoryDocument[]; nested?: boolean }) {
  const t = useTranslations("memory.documents");
  return (
    <RecordList className={nested ? "border [--shadow-card:none]" : undefined}>
      {items.map((item) => (
        <RecordRow
          key={item.id}
          code={nested ? undefined : (item.archive_code ?? "—")}
          thumb={nested ? undefined : item.preview_url ? fileUrl(item.preview_url) : null}
          title={item.title}
          href={item.href}
          lang={item.title_lang}
          meta={
            <>
              {nested && item.archive_code && <span className="cipher font-semibold text-primary">{item.archive_code}</span>}
              <Requisites item={item} />
              {item.fund && <span>{t("fund", { number: item.fund.number })}</span>}
            </>
          }
          aside={item.is_demo ? <DemoTag /> : undefined}
        >
          {item.note && <EditorialNote>{item.note}</EditorialNote>}
        </RecordRow>
      ))}
    </RecordList>
  );
}

/** Документы галереей: карточка с превью открытой цифровой копии, названием и реквизитами ведёт в карточку каталога. */
export function DocumentGallery({ items }: { items: MemoryDocument[] }) {
  const t = useTranslations("memory.documents");
  return (
    <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <article className="card lift group relative flex h-full flex-col overflow-hidden">
            <MediaImage src={item.preview_url && fileUrl(item.preview_url)} alt="" fallback={t("noImage")} className="aspect-[4/3] rounded-none border-0" />
            <div className="space-y-1 p-4">
              <h3 className="break-words text-base leading-snug" lang={item.title_lang}>
                {/* Ссылка растянута на всю карточку: превью тоже нажимается. */}
                <Link href={item.href} className="after:absolute after:inset-0 group-hover:text-primary">{item.title}</Link>
              </h3>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <Requisites item={item} />
                {item.archive_code && <span className="cipher">{item.archive_code}</span>}
                {item.is_demo && <DemoTag />}
              </p>
              {item.note && <EditorialNote>{item.note}</EditorialNote>}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

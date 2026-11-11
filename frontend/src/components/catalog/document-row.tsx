import { useLocale, useTranslations } from "next-intl";
import { RecordRow } from "@/components/ui/record-list";
import { Link } from "@/lib/i18n/navigation";
import type { DocumentItem } from "@/lib/api/catalog";
import { fileUrl } from "@/lib/api/document";
import { AccessBadge } from "./access-badge";
import { enumLabel } from "./labels";

/**
 * Строка документа в выдаче: миниатюра, шифр, название, реквизиты и фонд; статус доступа показан, когда он не открытый.
 * `fund={false}` — внутри дела и фонда, где фонд уже назван на странице.
 */
export function DocumentRow({ item, fund = true }: { item: DocumentItem; fund?: boolean }) {
  const t = useTranslations("catalog");
  const foreign = item.title_lang !== useLocale();
  return (
    <RecordRow
      code={
        <>
          {item.archive_code ?? "—"}
        </>
      }
      title={item.title}
      href={item.href}
      lang={foreign ? item.title_lang : undefined}
      thumb={item.preview_url ? fileUrl(item.preview_url) : null}
      meta={
        <>
          {item.date_text && <span>{item.date_text}</span>}
          {item.doc_type && <span>{enumLabel(t, "docTypes", item.doc_type)}</span>}
          {item.sheets_count ? <span>{t("doc.sheets", { count: item.sheets_count })}</span> : null}
          {item.authors && <span>{item.authors}</span>}
          {item.places.length > 0 && <span>{item.places.join(", ")}</span>}
        </>
      }
      aside={item.file_access !== "open" ? <AccessBadge access={item.file_access} /> : undefined}
    >
      {fund && item.fund && (
        <p className="mt-1 text-sm">
          <Link href={item.fund.href} className="text-link">{t("tree.fundOf", { number: item.fund.number })}</Link> {item.fund.title}
        </p>
      )}
    </RecordRow>
  );
}

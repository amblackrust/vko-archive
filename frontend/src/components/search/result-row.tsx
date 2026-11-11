import { useLocale, useTranslations } from "next-intl";
import { AccessBadge } from "@/components/catalog/access-badge";
import { enumLabel } from "@/components/catalog/labels";
import { RecordRow } from "@/components/ui/record-list";
import type { SearchItem } from "@/lib/api/search";

/** Строка результата поиска. У документа — шифр, дата, тип и статус доступа; у остальных типов — название и фрагмент. */
export function ResultRow({ item }: { item: SearchItem }) {
  const t = useTranslations("catalog");
  const foreign = item.lang !== useLocale();
  const doc = item.document;
  // У документа и фонда без подсветки фрагмент лишь повторяет шифр и реквизиты из индекса — он нужен, когда в нём есть совпадение.
  // Сервер разделяет поля записи переводом строки: в одной строке их разделяет косая черта.
  const plain = item.type === "document" || item.type === "fund";
  const snippet = plain && !item.snippet.includes("<mark>") ? "" : item.snippet.replace(/\s*\n\s*/g, " / ");
  return (
    <RecordRow
      code={doc ? (doc.archive_code ?? "—") : undefined}
      title={item.title}
      href={item.href}
      lang={foreign ? item.lang : undefined}
      meta={
        (doc?.date_text || doc?.doc_type || foreign) && (
          <>
            {doc?.date_text && <span>{doc.date_text}</span>}
            {doc?.doc_type && <span>{enumLabel(t, "docTypes", doc.doc_type)}</span>}
          </>
        )
      }
      aside={doc && doc.file_access !== "open" ? <AccessBadge access={doc.file_access} /> : undefined}
    >
      {snippet && (
        // Фрагмент — экранированный сервером HTML с <mark>: единственное место, где он вставляется как разметка (контракт /api/search).
        <p
          lang={foreign ? item.lang : undefined}
          className="mt-1 line-clamp-2 text-sm text-muted-foreground [&_mark]:rounded-sm [&_mark]:bg-accent-soft [&_mark]:px-0.5 [&_mark]:text-accent-soft-foreground"
          dangerouslySetInnerHTML={{ __html: snippet }}
        />
      )}
    </RecordRow>
  );
}

import { useTranslations } from "next-intl";
import { AccessBadge } from "@/components/catalog/access-badge";
import { enumLabel, periodLabel } from "@/components/catalog/labels";
import { FactList } from "@/components/ui/facts";
import { Link } from "@/lib/i18n/navigation";
import type { Ref } from "@/lib/api/catalog";
import type { DocumentDetail } from "@/lib/api/document";

type Fact = { label: string; value: React.ReactNode };
const filled = (items: Fact[]) => items.filter((item) => item.value !== null && item.value !== undefined && item.value !== false && item.value !== "");

/**
 * Все поля записи в боковой колонке — двумя карточками. «Сведения о документе»: короткие поля (дата, вид, язык, листы)
 * парами в две колонки, длинные — строками. «Место в архиве»: шифр и уровни иерархии ссылками, где хранится подлинник.
 * Пустые поля не выводятся; длинные шифры и названия переносятся.
 */
export function DocumentFacts({ doc }: { doc: DocumentDetail }) {
  const t = useTranslations("document");
  const c = useTranslations("catalog");
  const level = (ref: Ref | null, label: "fundOf" | "inventoryOf" | "caseOf") =>
    ref && (
      <>
        <Link href={ref.href} className="text-link cipher">{c(`tree.${label}`, { number: ref.number })}</Link>
        {ref.title && <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{ref.title}</span>}
      </>
    );
  const short = filled([
    { label: t("fields.date"), value: doc.date_text },
    { label: t("fields.type"), value: doc.doc_type && enumLabel(c, "docTypes", doc.doc_type) },
    { label: t("fields.period"), value: doc.period && periodLabel(c, doc.period) },
    { label: t("fields.language"), value: doc.language && enumLabel(c, "languages", doc.language) },
    { label: t("fields.sheets"), value: doc.sheets_count },
    { label: t("fields.digitalCopy"), value: t(doc.has_digital_copy ? "fields.yes" : "fields.no") },
  ]);
  const long = filled([
    { label: t("fields.author"), value: doc.authors },
    { label: t("fields.places"), value: doc.places.join(", ") },
    { label: t("fields.access"), value: <AccessBadge access={doc.file_access} className="text-base" /> },
    // У закрытых документов условия стоят в панели доступа; у открытых здесь — лицензия и источник файла.
    { label: t("access.conditions"), value: doc.file_access === "open" && doc.access_conditions && <span lang={doc.title_lang} className="whitespace-pre-line text-[0.9375rem] font-normal">{doc.access_conditions}</span> },
    {
      label: t("fields.topics"),
      value: doc.tags.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {doc.tags.map((tag) => <li key={tag.id}><Link href={tag.href} className="text-link">{tag.name}</Link></li>)}
        </ul>
      ),
    },
  ]);
  return (
    <div className="grid grid-cols-1 items-start gap-8 md:max-lg:grid-cols-2">
      <section aria-labelledby="doc-facts" className="space-y-3">
        <h2 id="doc-facts" className="text-xl">{t("sections.details")}</h2>
        <dl className="card overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-border">
            {short.map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5 bg-surface px-5 py-3 last:odd:col-span-2">
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                <dd className="min-w-0 break-words font-medium">{item.value}</dd>
              </div>
            ))}
          </div>
          {long.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5 border-t px-5 py-3">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="min-w-0 break-words font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="doc-place" className="space-y-3">
        <h2 id="doc-place" className="text-xl">{t("sections.place")}</h2>
        <FactList
          items={[
            { label: t("fields.code"), value: doc.archive_code && <span className="cipher">{doc.archive_code}</span> },
            { label: t("fields.fund"), value: level(doc.fund, "fundOf") },
            { label: t("fields.inventory"), value: level(doc.inventory, "inventoryOf") },
            { label: t("fields.case"), value: level(doc.case, "caseOf") },
            { label: t("fields.storage"), value: doc.storage_location && <span className="text-[0.9375rem] font-normal">{doc.storage_location}</span> },
            { label: t("fields.branch"), value: doc.branch },
          ]}
        />
      </section>
    </div>
  );
}

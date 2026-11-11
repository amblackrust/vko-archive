import { useTranslations } from "next-intl";
import { enumLabel, periodLabel } from "@/components/catalog/labels";
import { FactList } from "@/components/ui/facts";
import { Link } from "@/lib/i18n/navigation";
import type { Ref } from "@/lib/api/catalog";
import type { DocumentDetail } from "@/lib/api/document";

/** Все поля записи для боковой панели карточки. Пустые поля не выводятся; длинные шифры и названия переносятся. */
export function DocumentFacts({ doc }: { doc: DocumentDetail }) {
  const t = useTranslations("document.fields");
  const c = useTranslations("catalog");
  const level = (ref: Ref | null, label: "fundOf" | "inventoryOf" | "caseOf") =>
    ref && (
      <>
        <Link href={ref.href} className="text-link">{c(`tree.${label}`, { number: ref.number })}</Link>
        {ref.title && <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{ref.title}</span>}
      </>
    );
  return (
    <FactList
      items={[
        { label: t("code"), value: doc.archive_code && <span className="cipher">{doc.archive_code}</span> },
        { label: t("fund"), value: level(doc.fund, "fundOf") },
        { label: t("inventory"), value: level(doc.inventory, "inventoryOf") },
        { label: t("case"), value: level(doc.case, "caseOf") },
        { label: t("date"), value: doc.date_text },
        { label: t("period"), value: doc.period && periodLabel(c, doc.period) },
        { label: t("type"), value: doc.doc_type && enumLabel(c, "docTypes", doc.doc_type) },
        { label: t("language"), value: doc.language && enumLabel(c, "languages", doc.language) },
        { label: t("author"), value: doc.authors },
        { label: t("places"), value: doc.places.join(", ") },
        { label: t("sheets"), value: doc.sheets_count },
        { label: t("storage"), value: doc.storage_location },
        { label: t("branch"), value: doc.branch },
        { label: t("access"), value: c(`access.${doc.file_access}`) },
        { label: t("digitalCopy"), value: t(doc.has_digital_copy ? "yes" : "no") },
        {
          label: t("topics"),
          value: doc.tags.length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {doc.tags.map((tag) => <li key={tag.id}><Link href={tag.href} className="text-link">{tag.name}</Link></li>)}
            </ul>
          ),
        },
      ]}
    />
  );
}

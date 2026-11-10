import { useTranslations } from "next-intl";
import { enumLabel, periodLabel } from "@/components/catalog/labels";
import { Link } from "@/lib/i18n/navigation";
import type { DocumentDetail } from "@/lib/api/document";

/** Справочные поля карточки (T3.5). Длинные шифры и названия переносятся, не ломая вёрстку. */
export function DocumentDetails({ doc }: { doc: DocumentDetail }) {
  const t = useTranslations("document");
  const c = useTranslations("catalog");
  const rows: [string, React.ReactNode][] = [
    [t("fields.code"), doc.archive_code && <span className="break-all font-mono">{doc.archive_code}</span>],
    [t("fields.fund"), doc.fund && <Link className="text-primary hover:underline" href={doc.fund.href}>{c("tree.fundOf", { number: doc.fund.number })}{doc.fund.title && ` — ${doc.fund.title}`}</Link>],
    [t("fields.inventory"), doc.inventory && <Link className="text-primary hover:underline" href={doc.inventory.href}>{c("tree.inventoryOf", { number: doc.inventory.number })}{doc.inventory.title && ` — ${doc.inventory.title}`}</Link>],
    [t("fields.case"), doc.case && <Link className="text-primary hover:underline" href={doc.case.href}>{c("tree.caseOf", { number: doc.case.number })}{doc.case.title && ` — ${doc.case.title}`}</Link>],
    [t("fields.date"), doc.date_text],
    [t("fields.period"), doc.period && periodLabel(c, doc.period)],
    [t("fields.type"), doc.doc_type && enumLabel(c, "docTypes", doc.doc_type)],
    [t("fields.language"), doc.language && enumLabel(c, "languages", doc.language)],
    [t("fields.author"), doc.authors],
    [t("fields.places"), doc.places.join(", ")],
    [t("fields.sheets"), doc.sheets_count],
    [t("fields.storage"), doc.storage_location],
    [t("fields.branch"), doc.branch],
    [t("fields.access"), t(`access.${doc.file_access}`)],
    [t("fields.digitalCopy"), doc.has_digital_copy ? t("yes") : t("no")],
    [
      t("fields.topics"),
      doc.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {doc.tags.map((tag) => (
            <li key={tag.id}>
              <Link href={tag.href} className="rounded-full border bg-accent-soft px-2.5 py-0.5 text-sm text-accent-soft-foreground hover:opacity-80">{tag.name}</Link>
            </li>
          ))}
        </ul>
      ),
    ],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
      {rows
        .filter(([, value]) => value !== null && value !== undefined && value !== false && value !== "")
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

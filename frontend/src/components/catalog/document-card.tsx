import { Image as ImageIcon, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import type { DocumentItem } from "@/lib/api/catalog";
import { enumLabel, periodLabel } from "./labels";


/** Карточка документа в выдаче. Ссылка ведёт на карточку /catalog/documents/{id} (B07). */
export function DocumentCard({ item }: { item: DocumentItem }) {
  const t = useTranslations("catalog");
  const meta = [
    item.date_text,
    item.doc_type && enumLabel(t, "docTypes", item.doc_type),
    item.period && periodLabel(t, item.period),
    item.sheets_count ? t("doc.sheets", { count: item.sheets_count }) : null,
  ].filter(Boolean);
  return (
    <article className="rounded-lg border bg-surface p-4">
      <h3 className="text-lg font-semibold leading-snug">
        <Link href={item.href} className="hover:underline" lang={item.title_lang}>{item.title}</Link>
        {item.is_demo && <DemoBadge className="ml-2 align-middle" />}
      </h3>
      {item.archive_code && (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("doc.code")}: <span className="break-all font-mono text-foreground">{item.archive_code}</span>
        </p>
      )}
      {meta.length > 0 && <p className="mt-1 text-sm">{meta.join(" · ")}</p>}
      {(item.authors || item.places.length > 0) && (
        <p className="mt-1 text-sm text-muted-foreground">{[item.authors, ...item.places].filter(Boolean).join(" · ")}</p>
      )}
      {item.fund && item.inventory && item.case && (
        <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
          <Link href={item.fund.href} className="text-primary hover:underline">{t("doc.fund")} {item.fund.number}</Link>
          <Link href={item.inventory.href} className="text-primary hover:underline">{t("doc.inventory")} {item.inventory.number}</Link>
          <Link href={item.case.href} className="text-primary hover:underline">{t("doc.case")} {item.case.number}</Link>
        </p>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3.5" aria-hidden />
          {t(`access.${item.file_access}`)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="size-3.5" aria-hidden />
          {item.has_digital_copy ? t("doc.digitalCopy") : t("doc.noDigitalCopy")}
        </span>
      </p>
    </article>
  );
}

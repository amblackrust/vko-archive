import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { CaseItem, FundItem, InventoryItem } from "@/lib/api/catalog";
import { enumLabel } from "./labels";

type Entry =
  | { kind: "fund"; item: FundItem }
  | { kind: "inventory"; item: InventoryItem }
  | { kind: "case"; item: CaseItem };

/** Карточка фонда / описи / дела в списках иерархии. */
export function TreeCard({ entry }: { entry: Entry }) {
  const t = useTranslations("catalog");
  const { item } = entry;
  const heading =
    entry.kind === "fund"
      ? t("tree.fundOf", { number: item.number })
      : entry.kind === "inventory"
        ? t("tree.inventoryOf", { number: item.number })
        : t("tree.caseOf", { number: item.number });
  const counts: string[] = [];
  if (entry.kind === "fund") counts.push(t("tree.counts.inventories", { count: entry.item.inventory_count }));
  if (entry.kind === "inventory") counts.push(t("tree.counts.cases", { count: entry.item.case_count }));
  counts.push(t("tree.counts.documents", { count: item.document_count }));
  if (entry.kind === "case" && entry.item.sheets_count) counts.push(t("tree.sheetsCount", { count: entry.item.sheets_count }));
  const dates =
    entry.kind === "fund"
      ? entry.item.dates_from && entry.item.dates_to
        ? t("tree.years", { from: entry.item.dates_from, to: entry.item.dates_to })
        : null
      : entry.item.dates_text;
  return (
    <article className="rounded-lg border bg-surface p-4">
      <p className="text-sm text-muted-foreground">
        {heading}
        {entry.kind === "fund" && ` · ${enumLabel(t, "fundTypes", entry.item.type)}`}
      </p>
      <h3 className="mt-1 text-lg font-semibold leading-snug">
        <Link href={item.href} className="hover:underline" lang={item.title_lang}>{item.title || heading}</Link>
      </h3>
      {entry.kind !== "fund" && (
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href={entry.item.fund.href} className="hover:underline">{t("tree.fundOf", { number: entry.item.fund.number })}</Link>
          {entry.kind === "case" && (
            <>
              {" › "}
              <Link href={entry.item.inventory.href} className="hover:underline">{t("tree.inventoryOf", { number: entry.item.inventory.number })}</Link>
            </>
          )}
        </p>
      )}
      {dates && <p className="mt-1 text-sm">{dates}</p>}
      {entry.kind === "fund" && entry.item.annotation && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{entry.item.annotation}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{counts.join(" · ")}</p>
    </article>
  );
}

export type { Entry as TreeEntry };

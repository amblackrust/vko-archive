"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { enumLabel } from "@/components/catalog/labels";
import { Link } from "@/lib/i18n/navigation";
import type { SearchGroup, SearchItem } from "@/lib/api/search";

function ResultItem({ item }: { item: SearchItem }) {
  const tc = useTranslations("catalog");
  const doc = item.document;
  const meta = doc
    ? [doc.date_text, doc.doc_type && enumLabel(tc, "docTypes", doc.doc_type), doc.archive_code, tc(`access.${doc.file_access}`)]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <li className="rounded-lg border bg-surface p-4">
      {/* title — plain text */}
      <h3 className="font-semibold leading-snug">
        <Link href={item.href} lang={item.lang} className="text-primary hover:underline">{item.title}</Link>
      </h3>
      {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
      {/* snippet — экранированный сервером HTML с <mark>: единственное допустимое место для HTML (контракт /api/search) */}
      {item.snippet && (
        <p
          lang={item.lang}
          className="mt-1 text-sm [&_mark]:rounded-sm [&_mark]:bg-accent-soft [&_mark]:px-0.5 [&_mark]:text-accent-soft-foreground"
          dangerouslySetInnerHTML={{ __html: item.snippet }}
        />
      )}
    </li>
  );
}

/** Результаты по группам (документы, фонды, страницы, филиалы…) с подгрузкой «Показать ещё». */
export function ResultGroups({
  groups,
  loadingMore,
  onMore,
}: {
  groups: SearchGroup[];
  loadingMore: string | null;
  onMore: (type: string) => void;
}) {
  const t = useTranslations("search");
  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const title = t.has(`groups.${group.type}`) ? t(`groups.${group.type}`) : group.type;
        return (
          <section key={group.type} aria-labelledby={`group-${group.type}`}>
            <h2 id={`group-${group.type}`} className="mb-3 text-xl font-semibold">
              {title} <span className="text-base font-normal text-muted-foreground">({group.total})</span>
            </h2>
            <ul className="grid gap-3">
              {group.items.map((item) => (
                <ResultItem key={`${item.type}:${item.id}`} item={item} />
              ))}
            </ul>
            {group.items.length < group.total && (
              <Button
                variant="outline"
                className="mt-3"
                disabled={loadingMore === group.type}
                onClick={() => onMore(group.type)}
                aria-label={t("moreAria", { group: title })}
              >
                {t("more")}
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}

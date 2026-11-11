import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { FactList } from "@/components/ui/facts";
import { Field } from "@/components/ui/field";
import { GetForm } from "./get-form";
import { Pagination } from "@/components/ui/pagination";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { Link } from "@/lib/i18n/navigation";
import type { CaseItem, InventoryItem, Pagination as Paging, Ref } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

type Step = Pick<Ref, "number" | "title" | "href">;

/**
 * Путь по шифру — главный ориентир уровня: архив, фонд, опись, дело. Последний шаг — текущий уровень.
 * На узком экране шаги идут столбцом сверху вниз.
 */
export function CipherPath({ fund, inventory, archiveCase }: { fund: Step; inventory: Step; archiveCase?: Step }) {
  const t = useTranslations("catalog.tree");
  const steps = [
    { label: t("archive"), title: t("allFunds"), href: "/catalog/funds" },
    { label: t("fundOf", { number: fund.number }), title: fund.title, href: fund.href },
    { label: t("inventoryOf", { number: inventory.number }), title: inventory.title, href: inventory.href },
    ...(archiveCase ? [{ label: t("caseOf", { number: archiveCase.number }), title: archiveCase.title, href: archiveCase.href }] : []),
  ];
  return (
    <nav aria-label={t("path")}>
      <ol className="card grid overflow-hidden sm:grid-flow-col sm:auto-cols-fr">
        {steps.map((step, index) => {
          const current = index === steps.length - 1;
          return (
            <li
              key={step.href}
              aria-current={current ? "location" : undefined}
              className={cn("flex gap-2 border-t p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0", current && "bg-primary-soft")}
            >
              {index > 0 && <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <div className="min-w-0">
                {current ? (
                  <span className="cipher font-semibold">{step.label}</span>
                ) : (
                  <Link href={step.href} className="cipher font-semibold text-primary hover:underline">{step.label}</Link>
                )}
                <p className="line-clamp-2 text-sm text-muted-foreground">{step.title}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Шаблон страницы уровня (опись, дело): путь по шифру, слева вложенные записи, справа сведения об уровне.
 * Сведения стоят в разметке первыми, чтобы на телефоне идти перед длинным списком.
 */
export function Level({ path, facts, children }: { path: React.ReactNode; facts: React.ComponentProps<typeof FactList>["items"]; children: React.ReactNode }) {
  const t = useTranslations("catalog.tree");
  return (
    <div className="container-page space-y-10 py-8 pb-16">
      {path}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <aside aria-labelledby="level-facts" className="space-y-3 self-start lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
          <h2 id="level-facts" className="text-lg">{t("facts.title")}</h2>
          <FactList items={facts} />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * Список записей уровня: поиск по номеру и названию, число найденных, строки, страницы.
 * Без `heading` заголовком служит число найденных — так устроены общие списки описей и дел.
 */
export function LevelList({ heading, pathname, query, list, empty, children }: {
  heading?: string;
  pathname: string;
  query: URLSearchParams;
  list: Paging;
  /** Текст для уровня, в котором нет опубликованных записей. */
  empty: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("catalog");
  const searched = Boolean(query.get("q"));
  const count = t("results.count", { count: list.total });
  return (
    <section aria-labelledby="level-list" className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="level-list" className={heading ? "text-2xl" : "text-lg"}>{heading ?? count}</h2>
        {heading && <p className="text-sm text-muted-foreground">{count}</p>}
      </div>
      <GetForm key={query.toString()} pathname={pathname} role="search" className="flex max-w-2xl flex-wrap items-end gap-2">
        <Field label={t("tree.search")} name="q" type="search" defaultValue={query.get("q") ?? ""} className="min-w-48 flex-1" />
        <Button type="submit" variant="outline" className="h-11 px-5">{t("tree.searchSubmit")}</Button>
        {searched && <Button asChild variant="ghost" className="h-11"><Link href={pathname}>{t("tree.searchReset")}</Link></Button>}
      </GetForm>
      {list.total === 0 ? (
        <p className="card p-6 text-muted-foreground">{searched ? t("tree.nothingFound") : empty}</p>
      ) : (
        <RecordList>{children}</RecordList>
      )}
      <Pagination pathname={pathname} params={query} page={list.page} pages={list.pages} />
    </section>
  );
}

/** Реквизиты строки описи или дела: крайние даты и пометки; undefined — строка реквизитов не нужна. */
function levelMeta(item: InventoryItem | CaseItem, foreign: boolean) {
  if (!item.dates_text && !item.is_demo && !foreign) return undefined;
  return (
    <>
      {item.dates_text && <span>{item.dates_text}</span>}
      {foreign && <DemoBadge kind="noTranslation" />}
      {item.is_demo && <DemoTag />}
    </>
  );
}

function FundLine({ fund }: { fund: Ref }) {
  const t = useTranslations("catalog.tree");
  return (
    <p className="mt-1 text-sm">
      <Link href={fund.href} className="text-link">{t("fundOf", { number: fund.number })}</Link> {fund.title}
    </p>
  );
}

/** Строка описи. `full` — общий список: слева полный шифр, под названием фонд; внутри фонда достаточно номера. */
export function InventoryRow({ item, full }: { item: InventoryItem; full?: boolean }) {
  const t = useTranslations("catalog.tree");
  const label = t("inventoryOf", { number: item.number });
  const locale = useLocale();
  const foreign = Boolean(item.title) && item.title_lang !== locale;
  return (
    <RecordRow
      code={full ? t("cipher.inventory", { fund: item.fund.number, inventory: item.number }) : label}
      title={item.title || label}
      href={item.href}
      lang={foreign ? item.title_lang : undefined}
      meta={levelMeta(item, foreign)}
      aside={
        <>
          <span className="font-medium">{t("counts.cases", { count: item.case_count })}</span>
          <span className="text-muted-foreground">{t("counts.documents", { count: item.document_count })}</span>
        </>
      }
    >
      {full && <FundLine fund={item.fund} />}
    </RecordRow>
  );
}

/** Строка дела; `full` — как у описи. */
export function CaseRow({ item, full }: { item: CaseItem; full?: boolean }) {
  const t = useTranslations("catalog.tree");
  const label = t("caseOf", { number: item.number });
  const locale = useLocale();
  const foreign = Boolean(item.title) && item.title_lang !== locale;
  return (
    <RecordRow
      code={full ? t("cipher.case", { fund: item.fund.number, inventory: item.inventory.number, case: item.number }) : label}
      title={item.title || label}
      href={item.href}
      lang={foreign ? item.title_lang : undefined}
      meta={levelMeta(item, foreign)}
      aside={
        <>
          <span className="font-medium">{t("counts.documents", { count: item.document_count })}</span>
          {item.sheets_count ? <span className="text-muted-foreground">{t("sheetsCount", { count: item.sheets_count })}</span> : null}
        </>
      }
    >
      {full && <FundLine fund={item.fund} />}
    </RecordRow>
  );
}

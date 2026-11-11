import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LinkTile } from "@/components/ui/link-tile";
import { Pagination } from "@/components/ui/pagination";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { Link } from "@/lib/i18n/navigation";
import type { CaseItem, InventoryItem, Pagination as Paging, Ref } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";
import { GetForm } from "./get-form";

/**
 * Откуда запись: фонд и (для дела) опись — ссылка с номером и полное название. Стоит в шапке под заголовком
 * и вместе с «хлебными крошками» заменяет отдельную полосу пути.
 */
export function LevelLead({ fund, inventory }: { fund: Ref; inventory?: Ref }) {
  const t = useTranslations("catalog.tree");
  const line = (ref: Ref, label: string) => (
    <p>
      <Link href={ref.href} className="text-link cipher font-medium">{label}</Link> {ref.title}
    </p>
  );
  return (
    <div className="space-y-1 text-base">
      {inventory && line(inventory, t("inventoryOf", { number: inventory.number }))}
      {line(fund, t("fundOf", { number: fund.number }))}
    </div>
  );
}

/**
 * Список записей уровня: заголовок, число найденных, поиск по номеру и названию, записи, страницы.
 * Без `heading` заголовком служит число найденных — так устроены общие списки описей и дел, где поиск стоит в шапке страницы.
 * `search` — показать строку поиска внутри уровня (опись с десятками дел); при заданном запросе она видна всегда.
 */
export function LevelList({ heading, pathname, query, list, empty, search, children }: {
  heading?: string;
  pathname: string;
  query: URLSearchParams;
  list: Paging;
  /** Текст для уровня, в котором нет опубликованных записей. */
  empty: string;
  search?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("catalog");
  const searched = Boolean(query.get("q"));
  const count = t("results.count", { count: list.total });
  return (
    <section aria-labelledby="level-list" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="level-list" aria-live={heading ? undefined : "polite"} className={heading ? "text-2xl sm:text-3xl" : "text-xl"}>{heading ?? count}</h2>
          {heading && <p aria-live="polite" className="text-muted-foreground">{count}</p>}
        </div>
        {search || (heading && searched) ? (
          <GetForm key={query.toString()} pathname={pathname} role="search" aria-label={t("tree.search")} className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <Field label={t("tree.search")} name="q" type="search" defaultValue={query.get("q") ?? ""} className="min-w-0 flex-1 sm:w-72 [&>span]:sr-only" placeholder={t("tree.search")} />
            <Button type="submit" variant="outline" className="h-11 px-5">{t("tree.searchSubmit")}</Button>
            {searched && <Button asChild variant="ghost" className="h-11"><Link href={pathname}>{t("tree.searchReset")}</Link></Button>}
          </GetForm>
        ) : (
          searched && <Button asChild variant="outline" size="sm"><Link href={pathname}>{t("tree.searchReset")}</Link></Button>
        )}
      </div>
      {list.total === 0 ? <p className="card p-6 text-muted-foreground sm:p-8">{searched ? t("tree.nothingFound") : empty}</p> : children}
      <Pagination pathname={pathname} params={query} page={list.page} pages={list.pages} />
    </section>
  );
}

/** Подряд идущие записи с одним ключом — одна группа (порядок записей не меняется). */
export function groupAdjacent<T>(items: T[], key: (item: T) => string): T[][] {
  const groups: T[][] = [];
  let last = "";
  for (const item of items) {
    const current = key(item);
    if (groups.length > 0 && current === last) groups.at(-1)!.push(item);
    else groups.push([item]);
    last = current;
  }
  return groups;
}

/**
 * Группа общего списка — как в архивном справочнике: слева, чему принадлежат записи (фонд или опись), справа сами записи.
 * На узком экране подпись группы стоит над записями.
 */
export function LevelGroup({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 items-start gap-x-8 gap-y-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="min-w-0 lg:pt-4">{head}</div>
      <RecordList>{children}</RecordList>
    </section>
  );
}

/** Подпись группы: ссылка с шифром и название; для группы дел — ещё и фонд описи. */
export function GroupHead({ href, code, title, fund }: { href: string; code: string; title: string; fund?: Ref }) {
  const t = useTranslations("catalog.tree");
  return (
    <>
      <h3 className="text-[1.0625rem] font-semibold leading-snug">
        <Link href={href} className="cipher text-primary hover:underline">{code}</Link>
      </h3>
      <p className="mt-1 text-[0.9375rem]">{title}</p>
      {fund && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          <Link href={fund.href} className="cipher hover:text-primary hover:underline">{t("fundOf", { number: fund.number })}</Link> {fund.title}
        </p>
      )}
    </>
  );
}

/** Строка описи внутри фонда или группы: номер описи, название, число дел и документов. */
export function InventoryRow({ item, heading }: { item: InventoryItem; heading?: "h3" | "h4" }) {
  const t = useTranslations("catalog.tree");
  const label = t("inventoryOf", { number: item.number });
  const locale = useLocale();
  const foreign = Boolean(item.title) && item.title_lang !== locale;
  return (
    <RecordRow
      code={label}
      title={item.title || label}
      href={item.href}
      lang={foreign ? item.title_lang : undefined}
      meta={item.dates_text ? <span>{item.dates_text}</span> : undefined}
      heading={heading}
      aside={
        <>
          <span className="font-medium">{t("counts.cases", { count: item.case_count })}</span>
          <span className="text-muted-foreground">{t("counts.documents", { count: item.document_count })}</span>
        </>
      }
    />
  );
}

/** Строка дела внутри группы общего списка. */
export function CaseRow({ item, heading }: { item: CaseItem; heading?: "h3" | "h4" }) {
  const t = useTranslations("catalog.tree");
  const label = t("caseOf", { number: item.number });
  const locale = useLocale();
  const foreign = Boolean(item.title) && item.title_lang !== locale;
  return (
    <RecordRow
      code={label}
      title={item.title || label}
      href={item.href}
      lang={foreign ? item.title_lang : undefined}
      meta={item.dates_text ? <span>{item.dates_text}</span> : undefined}
      heading={heading}
      aside={
        <>
          <span className="font-medium">{t("counts.documents", { count: item.document_count })}</span>
          {item.sheets_count ? <span className="text-muted-foreground">{t("sheetsCount", { count: item.sheets_count })}</span> : null}
        </>
      }
    />
  );
}

/**
 * Сетка плиток без пустых ячеек: число колонок подбирается под число записей, а когда ровно не делится,
 * хвост закрывает плитка-переход (`filler` — сколько колонок она занимает). `min` — меньше стольких колонок не делать
 * (плитки с изображением не должны растягиваться на всю ширину).
 */
export function tilePlan(count: number, min = 1): { cols: 1 | 2 | 3 | 4; filler: 0 | 1 | 2 } {
  if (count < min) return { cols: min as 3, filler: (min - count) as 1 | 2 };
  if (count <= 4) return { cols: count as 1 | 2 | 3 | 4, filler: 0 };
  if (count % 3 === 0) return { cols: 3, filler: 0 };
  if (count % 4 === 0) return { cols: 4, filler: 0 };
  if (count % 3 === 2) return { cols: 3, filler: 1 };
  if (count % 4 === 3) return { cols: 4, filler: 1 };
  return { cols: 3, filler: 2 };
}

const GRID = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

/**
 * Сетка равных плиток уровня; `more` — плитка-переход на уровень выше, которой закрывается неполный ряд.
 * `quiet` — белая плитка вместо закрашенной: рядом с высокими плитками-изображениями синий блок был бы слишком тяжёлым.
 */
export function TileGrid({ count, min, more, quiet, className, children }: {
  count: number;
  min?: number;
  more: { href: string; title: string; text?: string };
  quiet?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const plan = tilePlan(count, min);
  return (
    <ul className={cn("grid auto-rows-fr gap-5", GRID[plan.cols], className)}>
      {children}
      {plan.filler > 0 && (
        <li className={cn("max-lg:hidden", plan.filler === 2 && "lg:col-span-2")}>
          <LinkTile accent={!quiet} href={more.href} title={more.title} text={more.text} />
        </li>
      )}
    </ul>
  );
}

/** Дело плиткой: номер, название, крайние даты, число документов и листов. Вся плитка — одна ссылка. */
export function CaseTile({ item }: { item: CaseItem }) {
  const t = useTranslations("catalog.tree");
  const label = t("caseOf", { number: item.number });
  const locale = useLocale();
  const foreign = Boolean(item.title) && item.title_lang !== locale;
  return (
    <li className="card lift group relative flex h-full flex-col p-5">
      <p className="cipher text-sm font-semibold text-primary">{label}</p>
      <h3 className="mt-1.5 text-[1.0625rem] font-semibold leading-snug [text-wrap:pretty]" lang={foreign ? item.title_lang : undefined}>
        <Link href={item.href} className="after:absolute after:inset-0 group-hover:text-primary">{item.title || label}</Link>
      </h3>
      {item.dates_text && <p className="mt-1 text-sm text-muted-foreground">{item.dates_text}</p>}
      <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-sm tabular-nums text-muted-foreground">
        <span>{t("counts.documents", { count: item.document_count })}</span>
        {item.sheets_count ? <span>{t("sheetsCount", { count: item.sheets_count })}</span> : null}
      </p>
    </li>
  );
}

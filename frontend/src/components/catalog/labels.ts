import type { useTranslations } from "next-intl";

type T = ReturnType<typeof useTranslations>;

/** Подпись значения справочника или само значение, если перевода нет. */
export function enumLabel(t: T, group: string, value: string): string {
  return t.has(`${group}.${value}`) ? t(`${group}.${value}`) : value;
}

/** «1950s» -> «1950-е» / «1950s» (шаблон catalog.period). */
export function periodLabel(t: T, value: string): string {
  const decade = value.replace(/s$/, "");
  return /^\d{4}$/.test(decade) ? t("period", { decade }) : value;
}

/** Годы документов фонда: «1926–1993», «с 2004 г.» или null, если сведений нет. */
export function fundYears(t: T, fund: { dates_from: number | null; dates_to: number | null }): string | null {
  if (fund.dates_from && fund.dates_to) {
    return fund.dates_from === fund.dates_to ? String(fund.dates_from) : t("tree.years", { from: fund.dates_from, to: fund.dates_to });
  }
  if (fund.dates_from) return t("funds.since", { year: fund.dates_from });
  return fund.dates_to ? String(fund.dates_to) : null;
}

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

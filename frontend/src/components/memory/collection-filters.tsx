import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FacetCount } from "@/lib/api/memory";
import { themeLabel } from "./theme-label";

interface Props {
  themes: FacetCount[];
  periods: FacetCount[];
  values: { q?: string; theme?: string; period?: string };
}

const selectClass = "h-10 w-full rounded-md border bg-surface px-3 text-sm";

/** Поиск по теме, периоду и слову: обычная GET-форма, работает без JS. */
export function CollectionFilters({ themes, periods, values }: Props) {
  const t = useTranslations("memory");
  const locale = useLocale();
  const active = Boolean(values.q || values.theme || values.period);
  return (
    <form action={`/${locale}/memory`} method="get" role="search" aria-label={t("filters.label")} className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
      <div>
        <label htmlFor="mem-q" className="mb-1 block text-sm font-medium">{t("filters.q")}</label>
        <Input id="mem-q" name="q" type="search" defaultValue={values.q ?? ""} />
      </div>
      <div>
        <label htmlFor="mem-theme" className="mb-1 block text-sm font-medium">{t("filters.theme")}</label>
        <select id="mem-theme" name="theme" defaultValue={values.theme ?? ""} className={selectClass}>
          <option value="">{t("filters.all")}</option>
          {themes.map((x) => <option key={x.value} value={x.value}>{themeLabel(t, x.value)} ({x.count})</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="mem-period" className="mb-1 block text-sm font-medium">{t("filters.period")}</label>
        <select id="mem-period" name="period" defaultValue={values.period ?? ""} className={selectClass}>
          <option value="">{t("filters.all")}</option>
          {periods.map((x) => <option key={x.value} value={x.value}>{x.value} ({x.count})</option>)}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit">{t("filters.submit")}</Button>
        {active && <Button asChild variant="outline"><a href={`/${locale}/memory`}>{t("filters.reset")}</a></Button>}
      </div>
    </form>
  );
}

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { withoutParam, withQuery, type CatalogFacets } from "@/lib/api/catalog";
import { FilterChip } from "./filter-chip";
import { enumLabel, periodLabel } from "./labels";

/** Группы подписей для значений-справочников; прочие значения показываются как есть. */
const ENUMS: Record<string, string> = { doc_type: "docTypes", language: "languages", fund_type: "fundTypes", category: "categories" };

/** Применённые условия чипами: каждый снимает ровно своё значение; рядом — сброс всех условий. */
export function ActiveFilters({ params, facets }: { params: URLSearchParams; facets: CatalogFacets }) {
  const t = useTranslations("catalog");
  const chips = [...params].filter(([key]) => key !== "sort" && key !== "page" && key !== "view");
  if (chips.length === 0) return null;
  const names = new Map([...facets.topic, ...facets.branch].map((facet) => [facet.value, facet.label]));
  const valueText = (key: string, value: string) =>
    key === "period" ? periodLabel(t, value) : ENUMS[key] ? enumLabel(t, ENUMS[key], value) : (names.get(value) ?? value);
  return (
    <ul aria-label={t("filters.active")} className="flex flex-wrap items-center gap-2">
      {chips.map(([key, value]) => {
        const field = t(`filters.fields.${key}`);
        const label = key === "has_digital_copy" ? field : `${field}: ${valueText(key, value)}`;
        return (
          <li key={`${key}=${value}`}>
            <FilterChip href={withQuery("/catalog", withoutParam(params, key, value))} label={label} hint={t("filters.remove", { name: label })} />
          </li>
        );
      })}
      <li><Link href="/catalog" className="text-link px-1 text-sm">{t("filters.reset")}</Link></li>
    </ul>
  );
}

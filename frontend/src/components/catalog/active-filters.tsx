import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { withoutParam, type CatalogFacets } from "@/lib/api/catalog";
import { enumLabel, periodLabel } from "./labels";

const SKIPPED = new Set(["sort", "page"]);

/** Чипы применённых фильтров; каждый — ссылка, которая снимает именно это значение. */
export function ActiveFilters({ params, facets }: { params: URLSearchParams; facets: CatalogFacets }) {
  const t = useTranslations("catalog");
  const labels = new Map<string, string>();
  for (const f of [...facets.topic, ...facets.branch]) if (f.label) labels.set(f.value, f.label);

  function valueText(key: string, value: string): string {
    if (key === "doc_type") return enumLabel(t, "docTypes", value);
    if (key === "language") return enumLabel(t, "languages", value);
    if (key === "fund_type") return enumLabel(t, "fundTypes", value);
    if (key === "category") return enumLabel(t, "categories", value);
    if (key === "period") return periodLabel(t, value);
    if (key === "has_digital_copy") return t("filters.has_digital_copy");
    return labels.get(value) ?? value;
  }

  const chips = [...params].filter(([key]) => !SKIPPED.has(key)) as [string, string][];
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t("filters.active")} className="flex flex-wrap gap-2">
      {chips.map(([key, value]) => {
        const name = key === "has_digital_copy" ? valueText(key, value) : `${t(`filters.${key === "title" ? "titleField" : key}`)}: ${valueText(key, value)}`;
        const query = withoutParam(params, key, value).toString();
        return (
          <li key={`${key}=${value}`}>
            <Link
              href={query ? `/catalog?${query}` : "/catalog"}
              aria-label={t("filters.remove", { name })}
              className="inline-flex items-center gap-1 rounded-full border bg-accent-soft px-3 py-1 text-sm text-accent-soft-foreground hover:opacity-80"
            >
              {name}
              <X className="size-3.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

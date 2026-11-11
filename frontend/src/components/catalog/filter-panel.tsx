import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Link } from "@/lib/i18n/navigation";
import type { CatalogFacets, FacetValue } from "@/lib/api/catalog";
import { enumLabel, periodLabel } from "./labels";

/** id формы поиска каталога: поля панели лежат вне <form> и привязаны к ней атрибутом `form` (работает без JS). */
export const CATALOG_FORM = "catalog-form";

/** Раскрывающаяся группа фильтров; закрытая группа занимает одну строку. */
function Group({ title, open, children }: { title: string; open: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group border-t first:border-t-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold hover:text-primary [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 pb-4">{children}</div>
    </details>
  );
}

/** Значения фасета с числом документов. Выбранное значение без совпадений остаётся в списке, чтобы его можно было снять. */
function Options({ name, label, values, selected, text, any }: {
  name: string;
  label: string;
  values: FacetValue[];
  selected: string[];
  text: (facet: FacetValue) => string;
  /** Подпись варианта «любое значение»: группа становится выбором одного значения. */
  any?: string;
}) {
  const known = new Set(values.map((facet) => facet.value));
  const all = [...values, ...selected.filter((value) => !known.has(value)).map((value) => ({ value, label: null, count: 0 }))];
  const row = "flex min-h-11 cursor-pointer items-center gap-3 lg:min-h-8";
  const input = { form: CATALOG_FORM, name, type: any ? "radio" : "checkbox", className: "size-4 shrink-0 accent-primary" };
  return (
    <ul aria-label={label}>
      {any && (
        <li>
          <label className={row}>
            <input {...input} value="" defaultChecked={selected.length === 0} />
            {any}
          </label>
        </li>
      )}
      {all.map((facet) => (
        <li key={facet.value}>
          <label className={row}>
            <input {...input} value={facet.value} defaultChecked={selected.includes(facet.value)} />
            <span className="min-w-0 flex-1 break-words">{text(facet)}</span>
            <span className="text-sm tabular-nums text-muted-foreground">{facet.count}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Панель фильтров документов: все условия, которые принимает API каталога, группами с числом документов. */
export function FilterPanel({ params, facets }: { params: URLSearchParams; facets: CatalogFacets }) {
  const t = useTranslations("catalog");
  const label = (name: string) => t(`filters.fields.${name}`);
  const has = (...names: string[]) => names.some((name) => params.has(name));
  const text = (name: string, type = "text") => (
    <Field key={name} form={CATALOG_FORM} name={name} type={type} label={label(name)} defaultValue={params.get(name) ?? ""} />
  );
  const facet = (name: string, values: FacetValue[], caption: (facet: FacetValue) => string, open = false) =>
    (values.length > 0 || has(name)) && (
      <Group title={label(name)} open={open || has(name)}>
        <Options name={name} label={label(name)} values={values} selected={params.getAll(name)} text={caption} />
      </Group>
    );
  return (
    <div className="card px-5">
      <Group title={label("category")} open>
        <Options name="category" label={label("category")} values={facets.category} selected={params.getAll("category")} text={(f) => enumLabel(t, "categories", f.value)} any={t("filters.anyCategory")} />
      </Group>
      {facet("doc_type", facets.doc_type, (f) => enumLabel(t, "docTypes", f.value), true)}
      {facet("period", facets.period, (f) => periodLabel(t, f.value), true)}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t font-semibold">
        <input form={CATALOG_FORM} type="checkbox" name="has_digital_copy" value="true" defaultChecked={params.get("has_digital_copy") === "true"} className="size-4 shrink-0 accent-primary" />
        <span className="flex-1">{label("has_digital_copy")}</span>
        <span className="text-sm font-normal tabular-nums text-muted-foreground">{facets.with_digital_copy}</span>
      </label>
      <Group title={t("filters.groups.dates")} open={has("year", "date_from", "date_to")}>
        {text("year", "number")}
        {text("date_from", "date")}
        {text("date_to", "date")}
      </Group>
      <Group title={t("filters.groups.code")} open={has("fund_number", "inventory_number", "case_number")}>
        {["fund_number", "inventory_number", "case_number"].map((name) => text(name))}
      </Group>
      <Group title={t("filters.groups.details")} open={has("title", "author", "place", "keyword")}>
        {["title", "author", "place", "keyword"].map((name) => text(name))}
      </Group>
      {facet("topic", facets.topic, (f) => f.label ?? f.value)}
      {facet("fund_type", facets.fund_type, (f) => enumLabel(t, "fundTypes", f.value))}
      {facet("branch_id", facets.branch, (f) => f.label ?? f.value)}
      {facet("language", facets.language, (f) => enumLabel(t, "languages", f.value))}
      <div className="flex flex-wrap gap-2 border-t py-4">
        <Button type="submit" form={CATALOG_FORM} className="h-11 px-6">{t("filters.apply")}</Button>
        <Button asChild variant="outline" className="h-11"><Link href="/catalog">{t("filters.reset")}</Link></Button>
      </div>
    </div>
  );
}

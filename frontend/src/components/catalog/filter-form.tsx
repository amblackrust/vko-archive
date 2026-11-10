import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/lib/i18n/navigation";
import type { CatalogFacets, FacetValue } from "@/lib/api/catalog";
import { enumLabel, periodLabel } from "./labels";

interface FilterFormProps {
  params: URLSearchParams;
  facets: CatalogFacets;
}

function Field({ name, label, params, type = "text" }: { name: string; label: string; params: URLSearchParams; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <Input name={name} type={type} defaultValue={params.get(name) ?? ""} />
    </label>
  );
}

interface CheckGroupProps {
  name: string;
  label: string;
  values: FacetValue[];
  params: URLSearchParams;
  text: (value: FacetValue) => string;
}

/** Группа чекбоксов; выбранные значения без совпадений остаются в списке (счётчик 0), чтобы их можно было снять. */
function CheckGroup({ name, label, values, params, text }: CheckGroupProps) {
  const selected = params.getAll(name);
  const known = new Set(values.map((v) => v.value));
  const all = [...values, ...selected.filter((v) => !known.has(v)).map((value) => ({ value, label: null, count: 0 }))];
  if (all.length === 0) return null;
  return (
    <fieldset className="text-sm">
      <legend className="mb-1 font-medium">{label}</legend>
      <ul className="space-y-1">
        {all.map((facet) => (
          <li key={facet.value}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name={name}
                value={facet.value}
                defaultChecked={selected.includes(facet.value)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="flex-1">{text(facet)}</span>
              <span className="text-muted-foreground">{facet.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="border-t py-3">
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

/** Панель фильтров: обычная GET-форма (работает без JS), все значения живут в URL. */
export function FilterForm({ params, facets }: FilterFormProps) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const hidden = ["sort", "category"].filter((key) => params.get(key));
  return (
    <form action={`/${locale}/catalog`} method="get" aria-label={t("filters.title")} className="rounded-lg border bg-surface p-4">
      <h2 className="mb-2 text-lg font-semibold">{t("filters.title")}</h2>
      {hidden.map((key) => (
        <input key={key} type="hidden" name={key} value={params.get(key) ?? ""} />
      ))}
      <Section title={t("filters.group.search")} open>
        <Field name="q" label={t("filters.q")} params={params} />
        <Field name="title" label={t("filters.titleField")} params={params} />
        <Field name="author" label={t("filters.author")} params={params} />
        <Field name="place" label={t("filters.place")} params={params} />
        <Field name="keyword" label={t("filters.keyword")} params={params} />
      </Section>
      <Section title={t("filters.group.code")} open={["fund_number", "inventory_number", "case_number"].some((k) => params.get(k))}>
        <Field name="fund_number" label={t("filters.fund_number")} params={params} />
        <Field name="inventory_number" label={t("filters.inventory_number")} params={params} />
        <Field name="case_number" label={t("filters.case_number")} params={params} />
      </Section>
      <Section title={t("filters.group.dates")} open={["year", "date_from", "date_to"].some((k) => params.get(k)) || params.has("period")}>
        <Field name="year" label={t("filters.year")} params={params} type="number" />
        <Field name="date_from" label={t("filters.date_from")} params={params} type="date" />
        <Field name="date_to" label={t("filters.date_to")} params={params} type="date" />
        <CheckGroup name="period" label={t("filters.period")} values={facets.period} params={params} text={(v) => periodLabel(t, v.value)} />
      </Section>
      <Section title={t("filters.group.attributes")} open>
        <CheckGroup name="doc_type" label={t("filters.doc_type")} values={facets.doc_type} params={params} text={(v) => enumLabel(t, "docTypes", v.value)} />
        <CheckGroup name="topic" label={t("filters.topic")} values={facets.topic} params={params} text={(v) => v.label ?? v.value} />
        <CheckGroup name="branch_id" label={t("filters.branch_id")} values={facets.branch} params={params} text={(v) => v.label ?? v.value} />
        <CheckGroup name="language" label={t("filters.language")} values={facets.language} params={params} text={(v) => enumLabel(t, "languages", v.value)} />
        <CheckGroup name="fund_type" label={t("filters.fund_type")} values={facets.fund_type} params={params} text={(v) => enumLabel(t, "fundTypes", v.value)} />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="has_digital_copy"
            value="true"
            defaultChecked={params.get("has_digital_copy") === "true"}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="flex-1">{t("filters.has_digital_copy")}</span>
          <span className="text-muted-foreground">{facets.with_digital_copy}</span>
        </label>
      </Section>
      <div className="mt-2 flex flex-wrap gap-2 border-t pt-4">
        <Button type="submit">{t("filters.apply")}</Button>
        <Button asChild variant="outline">
          <Link href="/catalog">{t("filters.reset")}</Link>
        </Button>
      </div>
    </form>
  );
}

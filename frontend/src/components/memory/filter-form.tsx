import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/** Поиск по слову, теме и периоду для коллекций и выставок: обычная GET-форма, работает без JavaScript. */
export function FilterForm({ path, label, values, themes, periods, text, className }: {
  /** Путь страницы без языка; якорь возвращает к результатам после отправки. */
  path: string;
  label: string;
  values: { q: string; theme: string; period: string };
  themes: Option[];
  periods: Option[];
  text: Record<"q" | "theme" | "period" | "all" | "submit" | "reset", string>;
  className?: string;
}) {
  const locale = useLocale();
  const all = { value: "", label: text.all };
  return (
    <form action={`/${locale}${path}`} method="get" role="search" aria-label={label} className={cn("card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_15rem_12rem_auto] lg:items-end", className)}>
      <Field label={text.q} name="q" type="search" defaultValue={values.q} maxLength={200} className="sm:col-span-2 lg:col-span-1" />
      <SelectField label={text.theme} name="theme" defaultValue={values.theme} options={[all, ...themes]} />
      <SelectField label={text.period} name="period" defaultValue={values.period} options={[all, ...periods]} />
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit">{text.submit}</Button>
        {(values.q || values.theme || values.period) && (
          <Button asChild variant="outline"><Link href={path}>{text.reset}</Link></Button>
        )}
      </div>
    </form>
  );
}

/** Значения формы из адреса: первое значение параметра, обрезанное до предела API (иначе тот ответит 422). */
export function filterValues(params: Record<string, string | string[] | undefined>) {
  const first = (key: string, max: number) => ((Array.isArray(params[key]) ? params[key][0] : params[key]) ?? "").trim().slice(0, max);
  return { q: first("q", 200), theme: first("theme", 128), period: first("period", 64) };
}

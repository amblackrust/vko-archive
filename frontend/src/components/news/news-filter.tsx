import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

interface Props {
  q: string;
  category: string;
  sort: string;
  categories: string[];
}

/** Поиск, категория и сортировка: обычная GET-форма без клиентского JS. */
export function NewsFilter({ q, category, sort, categories }: Props) {
  const t = useTranslations("news.filter");
  const tCategory = useTranslations("news.categories");
  const field = "h-10 rounded-md border bg-background px-3 font-normal";
  return (
    <form method="get" role="search" className="grid gap-3 rounded-lg border bg-surface p-4 md:grid-cols-[1fr_12rem_12rem_auto] md:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("q")}
        <input name="q" defaultValue={q} maxLength={200} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("category")}
        <select name="category" defaultValue={category} className={field}>
          <option value="">{t("all")}</option>
          {categories.map((value) => (
            <option key={value} value={value}>{tCategory.has(value) ? tCategory(value) : value}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("sort")}
        <select name="sort" defaultValue={sort} className={field}>
          <option value="date_desc">{t("newest")}</option>
          <option value="date_asc">{t("oldest")}</option>
        </select>
      </label>
      <div className="flex gap-2">
        <Button type="submit">{t("submit")}</Button>
        <Button asChild variant="ghost">
          <Link href="/news">{t("reset")}</Link>
        </Button>
      </div>
    </form>
  );
}

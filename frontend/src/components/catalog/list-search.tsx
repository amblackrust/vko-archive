import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Поиск по номеру и названию в списках фондов/описей/дел и внутри уровня иерархии (GET, без JS). */
export function ListSearch({ path, params }: { path: string; params: URLSearchParams }) {
  const t = useTranslations("catalog.tree");
  const locale = useLocale();
  const type = params.get("type");
  return (
    <form action={`/${locale}${path}`} method="get" role="search" className="flex max-w-xl gap-2">
      {type && <input type="hidden" name="type" value={type} />}
      <label className="sr-only" htmlFor="tree-q">{t("search")}</label>
      <Input id="tree-q" name="q" type="search" defaultValue={params.get("q") ?? ""} placeholder={t("search")} />
      <Button type="submit" variant="outline">{t("searchSubmit")}</Button>
    </form>
  );
}

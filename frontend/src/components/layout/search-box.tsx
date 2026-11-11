import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchHref } from "./nav-config";
import { cn } from "@/lib/utils";

/** Форма поиска в шапке: обычный GET на /<locale>/search?q=… (работает без JS). */
export function SearchBox({ className }: { className?: string }) {
  const t = useTranslations("layout.search");
  const locale = useLocale();
  return (
    <form role="search" aria-label={t("label")} action={`/${locale}${searchHref}`} method="get" className={cn("flex gap-2", className)}>
      <label htmlFor="site-search" className="sr-only">
        {t("label")}
      </label>
      <Input id="site-search" name="q" type="search" placeholder={t("placeholder")} autoComplete="off" />
      <Button type="submit" variant="outline" size="icon" aria-label={t("submit")}>
        <Search />
      </Button>
    </form>
  );
}

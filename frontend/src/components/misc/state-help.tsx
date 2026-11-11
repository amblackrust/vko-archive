import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkList } from "@/components/ui/link-list";
import { UnavailableState } from "@/components/ui/state-view";

const LINKS = [
  { id: "catalog", href: "/catalog" },
  { id: "funds", href: "/catalog/funds" },
  { id: "services", href: "/services" },
  { id: "branches", href: "/branches" },
  { id: "help", href: "/help" },
  { id: "contacts", href: "/contacts" },
] as const;

/** Помощь под системным состоянием (404, ошибка, «материал недоступен»): поиск по сайту и основные разделы. */
export function StateHelp() {
  const t = useTranslations("states.help");
  const locale = useLocale();
  return (
    // max-w задаётся вложенному блоку: у .container-page своя максимальная ширина.
    <div className="container-page pb-16">
      <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-2">
        <form action={`/${locale}/search`} method="get" role="search" className="self-start">
          <label htmlFor="state-search" className="mb-3 block text-base font-bold">{t("searchTitle")}</label>
          <div className="flex gap-2">
            <Input id="state-search" name="q" type="search" placeholder={t("searchPlaceholder")} className="h-11 text-base" />
            <Button type="submit" className="h-11"><Search aria-hidden />{t("searchSubmit")}</Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("searchHint")}</p>
        </form>
        <nav aria-label={t("linksTitle")}>
          <h2 className="mb-3 text-base">{t("linksTitle")}</h2>
          <LinkList items={LINKS.map((link) => ({ href: link.href, label: t(`links.${link.id}`) }))} />
        </nav>
      </div>
    </div>
  );
}

/** Страница, данные которой сейчас не получить (API недоступен или материал снят с публикации). */
export function Unavailable() {
  return (
    <>
      <UnavailableState />
      <StateHelp />
    </>
  );
}

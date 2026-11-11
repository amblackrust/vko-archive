import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkTile } from "@/components/ui/link-tile";
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
    <div className="container-page space-y-8 pb-16">
      <form action={`/${locale}/search`} method="get" role="search" className="max-w-2xl">
        <label htmlFor="state-search" className="mb-2 block font-semibold">{t("searchTitle")}</label>
        <div className="flex gap-2">
          <Input id="state-search" name="q" type="search" placeholder={t("searchPlaceholder")} className="h-12 text-base" />
          <Button type="submit" className="h-12"><Search aria-hidden />{t("searchSubmit")}</Button>
        </div>
      </form>
      <nav aria-label={t("linksTitle")}>
        <h2 className="text-xl">{t("linksTitle")}</h2>
        <ul className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((link) => <li key={link.id}><LinkTile href={link.href} title={t(`links.${link.id}`)} /></li>)}
        </ul>
      </nav>
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

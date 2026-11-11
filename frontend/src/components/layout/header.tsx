import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { MegaMenu } from "./mega-menu";
import { catalogHref } from "./nav-config";
import { QuickSearch } from "./quick-search";
import { SiteMenu } from "./site-menu";

/**
 * Шапка в одну строку: знак и наименование, разделы, поиск, каталог и кнопка бокового меню.
 * Язык, тема, версия для слабовидящих, контакты и соцсети собраны в боковом меню (SiteMenu).
 */
export function Header() {
  const t = useTranslations("layout");
  return (
    <header className="sticky top-0 z-30 bg-surface shadow-card" data-noprint>
      <div className="container-page flex h-16 items-center gap-4 lg:h-[4.5rem] lg:gap-6">
        <Logo className="shrink lg:shrink-0" />
        <MegaMenu />
        <div className="ml-auto flex items-center gap-2">
          <QuickSearch />
          <Button asChild className="hidden md:inline-flex">
            <Link href={catalogHref}>{t("catalogButton")}</Link>
          </Button>
          <SiteMenu />
        </div>
      </div>
    </header>
  );
}

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LanguageMenu } from "./language-menu";
import { Logo } from "./logo";
import { MegaMenu } from "./mega-menu";
import { catalogHref } from "./nav-config";
import { QuickSearch } from "./quick-search";
import { SiteMenu } from "./site-menu";
import { ViewSettings } from "./view-settings";

/**
 * Шапка в одну строку: знак и наименование, разделы, затем лупа поиска, язык, настройки отображения и каталог.
 * На телефоне разделы уходят в меню на весь экран (SiteMenu), остальное остаётся на месте.
 */
export function Header() {
  const t = useTranslations("layout");
  return (
    <header className="sticky top-0 z-30 bg-surface shadow-card" data-noprint>
      <div className="container-page flex h-16 items-center gap-4 lg:h-[4.5rem] lg:gap-6">
        <Logo className="shrink lg:shrink-0" />
        <MegaMenu />
        <div className="ml-auto flex items-center gap-0.5">
          <QuickSearch />
          <Suspense fallback={null}>
            <LanguageMenu compact />
          </Suspense>
          <div className="max-lg:hidden"><ViewSettings /></div>
          <Button asChild className="ml-2 hidden md:inline-flex">
            <Link href={catalogHref}>{t("catalogButton")}</Link>
          </Button>
          <SiteMenu />
        </div>
      </div>
    </header>
  );
}

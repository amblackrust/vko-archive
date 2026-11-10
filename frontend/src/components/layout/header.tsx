import { Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { MegaMenu } from "./mega-menu";
import { MobileMenu } from "./mobile-menu";
import { catalogHref } from "./nav-config";
import { SearchBox } from "./search-box";
import { SocialLinks } from "./social-links";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const t = useTranslations("layout");
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="container-page flex items-center gap-3 py-3">
        <Link href="/" aria-label={t("homeLink")} className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 font-serif text-sm font-semibold leading-tight sm:text-base">
            <span className="hidden sm:inline">{t("siteName")}</span>
            <span className="sm:hidden">{t("siteShort")}</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <SearchBox className="hidden w-64 xl:flex" />
          <Button asChild className="hidden md:inline-flex">
            <Link href={catalogHref}>{t("catalogButton")}</Link>
          </Button>
          <Suspense fallback={null}>
            <LocaleSwitcher />
          </Suspense>
          <ThemeToggle />
          <SocialLinks className="hidden md:flex" />
          <MobileMenu />
        </div>
      </div>
      <div className="hidden border-t lg:block">
        <div className="container-page flex items-center justify-between py-1">
          <MegaMenu />
          <a href="tel:+77232251322" className="text-sm font-medium text-primary">
            {t("contactsBlock.phoneValue")}
          </a>
        </div>
      </div>
      <div className="container-page pb-3 xl:hidden">
        <SearchBox />
      </div>
    </header>
  );
}

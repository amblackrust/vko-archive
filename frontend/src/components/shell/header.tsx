import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";
import { CommandMenu } from "./command-menu";
import { LangSwitch } from "./lang-switch";
import { ThemeSwitch } from "./theme-switch";
import { A11yPanel } from "./a11y-panel";
import { SectionIndex } from "./section-index";
import { AssistantButton } from "./assistant-button";
import { iconButtonClass } from "@/components/ui/icon-button";

export async function Header() {
  const t = await getTranslations("common");
  return (
    <header className="glassine sticky top-0 z-40 border-b border-frame/70">
      <div className="wrap flex h-[var(--header-h)] items-center gap-5">
        <Link href="/" className="flex shrink-0 items-center gap-3 no-underline" aria-label={t("siteName")}>
          <LogoMark />
          <span className="hidden font-display text-[1.05rem] leading-[1.1] sm:block">{t("siteShort")}</span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-0.5">
          <AssistantButton />
          <CommandMenu />
          <Suspense>
            <LangSwitch />
          </Suspense>
          <span className="contents max-sm:hidden">
            <ThemeSwitch />
            <A11yPanel />
          </span>
          <Link href="/cabinet" aria-label={t("cabinet")} title={t("cabinet")} className={`${iconButtonClass} max-sm:hidden`}>
            <UserRound size={18} />
          </Link>
          <SectionIndex />
        </div>
      </div>
    </header>
  );
}

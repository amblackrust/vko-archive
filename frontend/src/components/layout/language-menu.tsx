"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Menu, menuItem } from "@/components/ui/menu";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { localeLabels, routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Язык сайта выпадающим списком: полные названия, текущий отмечен; путь и параметры запроса сохраняются.
 * Требует <Suspense> выше (useSearchParams). `compact` — в шапке сайта видно только «RU».
 */
export function LanguageMenu({ compact }: { compact?: boolean }) {
  const t = useTranslations("layout.language");
  const current = useLocale() as keyof typeof localeLabels;
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;
  return (
    <Menu
      label={t("label")}
      panelClassName="w-52"
      trigger={
        <>
          <Globe className="size-[1.125rem] text-muted-foreground" aria-hidden />
          <span className={cn("font-semibold", !compact && "sm:hidden")}>{localeLabels[current].short}</span>
          {!compact && <span className="max-sm:hidden">{localeLabels[current].name}</span>}
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </>
      }
    >
      {routing.locales.map((locale) => (
        <Link key={locale} href={href} locale={locale} hrefLang={locale} lang={locale} aria-current={locale === current ? "true" : undefined} className={cn(menuItem, locale === current && "bg-primary-soft text-primary hover:bg-primary-soft")}>
          <span className="flex-1">{localeLabels[locale].name}</span>
          {locale === current ? <Check className="size-4" aria-hidden /> : <span className="text-xs text-muted-foreground">{localeLabels[locale].short}</span>}
        </Link>
      ))}
    </Menu>
  );
}

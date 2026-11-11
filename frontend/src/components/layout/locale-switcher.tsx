"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { localeLabels, routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/** Компактный переключатель языка (админка): путь и параметры запроса сохраняются. Требует <Suspense> выше. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("layout.language");
  const current = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;
  return (
    <nav aria-label={t("label")} className={cn("flex items-center gap-0.5 rounded-full bg-surface-muted p-0.5", className)}>
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={href}
          locale={locale}
          hrefLang={locale}
          lang={locale}
          title={localeLabels[locale].name}
          aria-current={locale === current ? "true" : undefined}
          className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", locale === current ? "bg-primary text-primary-foreground" : "hover:text-primary")}
        >
          {localeLabels[locale].short}
        </Link>
      ))}
    </nav>
  );
}

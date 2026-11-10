"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { localeLabels, routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/** KZ/RU/EN: сохраняет текущий путь и query-параметры. Требует <Suspense> выше. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("layout.language");
  const current = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <nav aria-label={t("label")} className={cn("flex items-center rounded-md border p-0.5", className)}>
      {routing.locales.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={href}
            locale={locale}
            hrefLang={locale}
            lang={locale}
            title={localeLabels[locale].name}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-sm px-2 py-1 text-xs font-semibold",
              active ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted",
            )}
          >
            {localeLabels[locale].short}
          </Link>
        );
      })}
    </nav>
  );
}

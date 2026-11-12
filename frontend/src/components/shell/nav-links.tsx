"use client";

import { useTranslations } from "next-intl";
import clsx from "clsx";
import { Link, usePathname } from "@/i18n/navigation";
import { PRIMARY } from "@/lib/nav";

export function NavLinks() {
  const t = useTranslations("nav.primary");
  const pathname = usePathname();
  return (
    <nav aria-label={t("catalog")} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {PRIMARY.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={clsx(
                  "relative inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 font-medium no-underline transition-colors",
                  current ? "text-ink" : "text-ink-2 hover:bg-mount-2 hover:text-ink",
                  // The current page is underlined.
                  current && "after:absolute after:inset-x-3.5 after:bottom-0 after:h-[3px] after:rounded-full after:bg-action",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

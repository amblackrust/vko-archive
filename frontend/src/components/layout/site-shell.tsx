"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";
import { Footer } from "./footer";
import { Header } from "./header";

/** Разделы без публичной шапки/подвала (у админки свой каркас). */
export function useIsAdminArea() {
  return usePathname().startsWith("/admin");
}

/** Общий каркас страницы: skip-link, шапка, <main id="main">, подвал. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  if (useIsAdminArea()) return <>{children}</>;
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("skipToContent")}
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";
import { Footer } from "./footer";
import { Header } from "./header";

/** Разделы без публичной шапки/подвала (у админки свой каркас). */
export function useIsAdminArea() {
  return usePathname().startsWith("/admin");
}

/** SVG-фильтр для класса .inked: светлая кромка под буквой и тень над ней. */
function PrintFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <filter id="inked" x="-3%" y="-6%" width="106%" height="112%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.4" result="d" />
        <feOffset in="d" dy="1.4" result="lo" />
        <feFlood floodColor="#fff" floodOpacity="0.95" />
        <feComposite in2="lo" operator="in" />
        <feComposite in2="SourceAlpha" operator="out" result="lip" />
        <feOffset in="d" dy="-1.2" result="hi" />
        <feGaussianBlur in="hi" stdDeviation="0.6" result="hiB" />
        <feFlood floodColor="#1f1a12" floodOpacity="0.28" />
        <feComposite in2="hiB" operator="in" />
        <feComposite in2="SourceAlpha" operator="out" result="rim" />
        <feMerge>
          <feMergeNode in="rim" />
          <feMergeNode in="lip" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  );
}

/** Общий каркас страницы: skip-link, шапка, <main id="main">, подвал. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  if (useIsAdminArea()) return <div className="site-admin">{children}</div>;
  return (
    <div className="site-public flex min-h-screen flex-col">
      <PrintFilters />
      <a
        href="#main"
        className="caps sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
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

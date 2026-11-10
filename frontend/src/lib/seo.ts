import { routing } from "@/lib/i18n/routing";

/** Базовый адрес сайта для canonical, hreflang, sitemap и robots. Задаётся в окружении сборки/запуска. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3114").replace(/\/$/, "");

/** path — путь без языка: "" для главной, иначе "/about" и т.п. */
export function localeUrl(locale: string, path: string): string {
  return `${SITE_URL}/${locale}${path}`;
}

/** canonical и hreflang (kk/ru/en) для страницы. Каждая страница передаёт свой path. */
export function localizedAlternates(locale: string, path: string) {
  return {
    canonical: localeUrl(locale, path),
    languages: Object.fromEntries(routing.locales.map((l) => [l, localeUrl(l, path)])),
  };
}

import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api/client";
import { routing } from "@/lib/i18n/routing";
import { localeUrl, localizedAlternates } from "@/lib/seo";

/** Публичные страницы без параметров. Закрытые материалы и служебные разделы сюда не входят.
 * Новые публичные разделы добавляются сюда вместе с их маршрутом. */
const staticPaths = [
  "",
  "/about",
  "/about/history",
  "/about/structure",
  "/branches",
  "/catalog",
  "/catalog/funds",
  "/catalog/newspapers",
  "/memory",
  "/memory/timeline",
  "/memory/map",
  "/exhibitions",
  "/news",
  "/navigator",
  "/assistant",
  "/compliance",
  "/contacts",
  "/help",
  "/help/faq",
  "/help/reading-room",
  "/legal",
  "/privacy",
  "/services",
  "/services/state",
  "/services/paid",
  "/calendar",
  "/publications",
  "/symbols",
  "/links",
];

/** Адреса опубликованных объектов из открытых списков API. Без API возвращается пусто: карта сайта не должна отдавать 500. */
async function listPaths(endpoint: string, prefix: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/api/${endpoint}?lang=${routing.defaultLocale}`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as { items: { slug: string }[] };
    return data.items.map((item) => `${prefix}/${item.slug}`);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamicPaths = await Promise.all([
    listPaths("branches", "/branches"),
    listPaths("exhibitions", "/exhibitions"),
    listPaths("memory/collections", "/memory/collections"),
    listPaths("memory/persons", "/memory/persons"),
    listPaths("news", "/news"),
  ]);
  const paths = [...staticPaths, ...dynamicPaths.flat()];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: localeUrl(locale, path),
      alternates: { languages: localizedAlternates(locale, path).languages },
    })),
  );
}

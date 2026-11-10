import type { MetadataRoute } from "next";
import { fetchBranches } from "@/lib/api/branches";
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
  "/compliance",
  "/contacts",
  "/help",
  "/help/faq",
  "/help/reading-room",
  "/legal",
  "/privacy",
  "/services/state",
  "/services/paid",
  "/calendar",
  "/publications",
  "/symbols",
  "/links",
];

async function publicBranchPaths(): Promise<string[]> {
  try {
    const branches = await fetchBranches(routing.defaultLocale);
    return branches.map((branch) => `/branches/${branch.slug}`);
  } catch {
    // Без API карта сайта всё равно отдаётся со статическими страницами: поисковик не должен получать 500.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = [...staticPaths, ...(await publicBranchPaths())];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: localeUrl(locale, path),
      alternates: { languages: localizedAlternates(locale, path).languages },
    })),
  );
}

import type { MetadataRoute } from "next";
import { api, type Schema } from "@/lib/api/client";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SECTIONS = [
  "",
  "/catalog",
  "/exhibitions",
  "/memory",
  "/memory/collections",
  "/memory/persons",
  "/memory/timeline",
  "/memory/map",
  "/news",
  "/branches",
  "/help",
  "/help/faq",
  "/help/reading-room",
  "/services/state",
  "/services/paid",
  "/legal",
  "/about",
  "/about/contacts",
  "/calendar",
  "/links",
  "/compliance",
  "/publications",
  "/symbols",
];

// The news API returns at most 50 items per page: the newest 50 go to the sitemap.
/** Every section and every published exhibition, news item and branch, in all languages with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [exhibitions, news, branches] = await Promise.all([
    api.get<Schema["ExhibitionList"]>("/api/exhibitions", { query: { lang: "ru" } }).catch(() => null),
    api.get<Schema["NewsList"]>("/api/news", { query: { lang: "ru", per_page: 50 } }).catch(() => null),
    api.get<Schema["BranchesResponse"]>("/api/branches", { query: { lang: "ru" } }).catch(() => null),
  ]);
  const paths = [
    ...SECTIONS,
    ...(exhibitions?.items ?? []).map((e) => `/exhibitions/${e.slug}`),
    ...(news?.items ?? []).map((n) => `/news/${n.slug}`),
    ...(branches?.items ?? []).map((b) => `/branches/${b.slug}`),
  ];
  return paths.flatMap((path) => {
    const languages = Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`]));
    return routing.locales.map((locale) => ({ url: `${base}/${locale}${path}`, alternates: { languages } }));
  });
}

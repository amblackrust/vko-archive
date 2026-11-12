import type { Metadata } from "next";
import { api, type Schema } from "@/lib/api/client";
import { routing } from "@/i18n/routing";

const OG_LOCALES: Record<string, string> = { ru: "ru_RU", kk: "kk_KZ", en: "en_US" };

/** Public origin of the site: the same FRONTEND_URL the backend uses for e-mail links. */
export function siteUrl(): string {
  return (process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Title, description, Open Graph and hreflang alternates for a page. `path` has no locale prefix ("" is the home page). */
export function pageMeta({ locale, path, title, description, absolute }: { locale: string; path: string; title: string; description?: string | null; absolute?: boolean }): Metadata {
  const desc = description ? description.replace(/\s+/g, " ").trim().slice(0, 160) : undefined;
  return {
    title: absolute ? { absolute: title } : title,
    description: desc,
    alternates: { canonical: `/${locale}${path}`, languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])) },
    openGraph: { title, description: desc, locale: OG_LOCALES[locale], type: "website", url: `/${locale}${path}` },
  };
}

/** Title and description from the public document; a missing one yields no metadata and a document without open files is kept out of search engines. */
export async function generateDocMeta(id: string, locale: string) {
  const doc = await api.get<Schema["DocumentDetail"]>(`/api/catalog/documents/${id}`, { query: { lang: locale } }).catch(() => null);
  if (!doc) return {};
  const meta = pageMeta({ locale, path: `/catalog/documents/${id}`, title: doc.title, description: doc.summary });
  return doc.file_access === "open" ? meta : { ...meta, robots: { index: false, follow: false } };
}

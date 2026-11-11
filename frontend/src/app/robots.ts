import type { MetadataRoute } from "next";
import { routing } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/seo";

/** Админка, кабинет, API и выдача поиска не индексируются. Закрытые материалы защищены на сервере. */
const closedPaths = ["/admin", "/cabinet", "/search"];

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/api",
    // Админка под любым префиксом (в т.ч. без локали и с будущими локалями).
    "/admin",
    "/*/admin",
    ...routing.locales.flatMap((locale) => closedPaths.map((path) => `/${locale}${path}`)),
  ];
  return {
    rules: { userAgent: "*", allow: "/", disallow },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// One JSON file per area keeps dictionaries reviewable; all are merged into one tree.
const NAMESPACES = ["common", "nav", "footer", "home", "dict", "search", "catalog", "document", "assistant", "exhibitions", "news", "memory", "branches", "info", "cabinet", "admin"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const parts = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );
  return { locale, messages: Object.fromEntries(parts) };
});

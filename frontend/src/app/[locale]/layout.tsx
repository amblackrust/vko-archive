import type { Metadata } from "next";
import { Golos_Text, Literata } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { a11yInitScript } from "@/components/layout/a11y-init";
import { AssistantWidget } from "@/components/ai/chat/assistant-widget";
import { SiteSettingsProvider } from "@/components/layout/site-settings";
import { SiteShell } from "@/components/layout/site-shell";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { fetchSiteSettings } from "@/lib/api/site-settings";
import { routing } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import "../globals.css";

// cyrillic-ext содержит казахские ә ғ қ ң ө ұ ү һ; і — в cyrillic.
const sans = Golos_Text({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-sans-face",
  display: "swap",
});
const reading = Literata({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-reading-face",
  display: "swap",
});

/**
 * Языковые версии собираются заранее только в production-сборке. В режиме разработки список пуст: иначе
 * dev-сервер при каждом новом адресе переписывает .next/prerender-manifest.json, и параллельные запросы
 * портят этот файл (после чего все страницы отдают 500).
 */
export function generateStaticParams() {
  return process.env.NODE_ENV === "production" ? routing.locales.map((locale) => ({ locale })) : [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "layout" });
  const seo = await getTranslations({ locale, namespace: "misc.seo" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("siteName"), template: `%s | ${t("siteShort")}` },
    description: seo("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const siteSettings = await fetchSiteSettings(locale);

  return (
    <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${reading.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: a11yInitScript }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>
            <SiteSettingsProvider value={siteSettings}>
              <SiteShell>{children}</SiteShell>
            </SiteSettingsProvider>
            <AssistantWidget />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

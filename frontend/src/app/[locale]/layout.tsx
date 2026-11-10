import type { Metadata } from "next";
import { Inter, PT_Serif } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AssistantWidget } from "@/components/ai/chat/assistant-widget";
import { SiteShell } from "@/components/layout/site-shell";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { routing } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import "../globals.css";

// cyrillic-ext содержит казахские ә ғ қ ң ө ұ ү һ; і — в cyrillic.
const sans = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-sans-face",
  display: "swap",
});
const serif = PT_Serif({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "700"],
  variable: "--font-serif-face",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
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

  return (
    <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>
            <SiteShell>{children}</SiteShell>
            <AssistantWidget />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

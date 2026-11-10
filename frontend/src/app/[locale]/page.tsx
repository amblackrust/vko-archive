import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

// Заглушка: настоящую главную делает пачка B17 (T5.1).
export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("layout.home");
  return (
    <div className="container-page py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t("stub")}</p>
    </div>
  );
}

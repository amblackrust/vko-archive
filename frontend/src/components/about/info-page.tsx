import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageBody } from "@/components/about/page-body";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TranslationNote } from "@/components/help/translation-note";
import { fetchPage } from "@/lib/api/content";

/** Информационная страница из таблицы pages (T5.2): заголовок, тело и пометка о переводе. */
export async function InfoPage({ pageKey, locale }: { pageKey: string; locale: string }) {
  const page = await fetchPage(pageKey, locale);
  if (!page) notFound();
  const t = await getTranslations("about");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/about" }, { label: page.title }]} />
      <div className="container-page space-y-6 pb-12">
        <h1 className="text-3xl font-bold" lang={page.lang}>{page.title}</h1>
        <TranslationNote requested={locale} actual={page.lang} status={page.translation_status} />
        <PageBody html={page.body} lang={page.lang} />
      </div>
    </>
  );
}

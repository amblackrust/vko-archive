import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, SeeAlso } from "@/components/misc/page-layout";
import { PageHeader } from "@/components/ui/page-header";

const SECTIONS = ["data", "search", "cabinet", "location", "cookies", "external", "contact"] as const;

export const generateMetadata = pageMetadata("misc.privacy", "/privacy");

/** Политика конфиденциальности: какие данные сайт получает и куда передаёт. */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.privacy");
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageBody
        aside={
          <SeeAlso
            title={t("more.title")}
            items={[
              { href: "/legal", label: t("more.legal"), text: t("more.legalText") },
              { href: "/contacts", label: t("more.contacts") },
            ]}
          />
        }
      >
        {SECTIONS.map((id) => (
          <Block key={id} id={id} title={t(`sections.${id}.title`)}>
            <p className="max-w-3xl">{t(`sections.${id}.text`)}</p>
          </Block>
        ))}
      </PageBody>
    </>
  );
}

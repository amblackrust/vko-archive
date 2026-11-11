import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageSection, PageStack } from "@/components/misc/blocks";
import { pageMetadata } from "@/components/misc/metadata";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";

const SECTIONS = ["data", "search", "cabinet", "location", "cookies", "external", "contact"] as const;

export const generateMetadata = pageMetadata("misc.privacy", "/privacy");

/** Политика конфиденциальности: какие данные сайт получает и куда передаёт. Вопрос слева, ответ справа — одной карточкой. */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.privacy");
  const contacts = await getTranslations("help");
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageStack>
        <div className="card divide-y px-5 sm:px-8">
          {SECTIONS.map((id) => (
            <section key={id} id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-28 gap-x-10 gap-y-2 py-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:py-7">
              <h2 id={`${id}-title`} className="text-xl">{t(`sections.${id}.title`)}</h2>
              <p className="max-w-3xl">{t(`sections.${id}.text`)}</p>
            </section>
          ))}
        </div>

        <PageSection id="more" title={t("more.title")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
            <li><LinkTile href="/legal" title={t("more.legal")} text={t("more.legalText")} /></li>
            <li><LinkTile href="/contacts" title={t("more.contacts")} text={contacts("faq.more.contactsText")} /></li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}

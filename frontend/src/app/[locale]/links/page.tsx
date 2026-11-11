import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageSection, PageStack } from "@/components/misc/blocks";
import { pageMetadata } from "@/components/misc/metadata";
import { SourceCard } from "@/components/misc/source-card";
import { GovServiceCard, type GovService } from "@/components/ui/brand";
import { ExternalLink } from "@/components/ui/external-link";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { fetchSiteSettings } from "@/lib/api/site-settings";

/** Государственные порталы по назначению; адреса заданы в govServices. */
const GROUPS: { id: string; services: GovService[] }[] = [
  { id: "state", services: ["akorda", "akimat", "govkz"] },
  { id: "services", services: ["egov", "eotinish", "adilet"] },
];

export const generateMetadata = pageMetadata("misc.links", "/links");

/** Полезные ссылки: карточки государственных порталов; ссылки и опрос, добавленные архивом в настройках сайта, показываются ниже. */
export default async function LinksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.links");
  const settings = await fetchSiteSettings(locale);
  const grid = "grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3";

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageStack>
        {GROUPS.map((group) => (
          <PageSection key={group.id} id={group.id} title={t(`groups.${group.id}`)}>
            <ul className={grid}>
              {group.services.map((id) => <li key={id}><GovServiceCard id={id} /></li>)}
            </ul>
          </PageSection>
        ))}

        {settings && settings.useful_links.length > 0 && (
          <PageSection id="added" title={t("groups.added")}>
            <ul className={grid}>
              {settings.useful_links.map((link) => <li key={link.url}><SourceCard href={link.url} title={link.title} /></li>)}
            </ul>
          </PageSection>
        )}

        {settings?.survey.enabled && (
          <PageSection id="survey" title={t("site.survey")} text={t("site.surveyNote")}>
            <div className="card flex flex-wrap items-center justify-between gap-x-10 gap-y-3 p-6">
              <p className="text-[1.0625rem] font-medium">{settings.survey.question}</p>
              {settings.survey.url && <ExternalLink href={settings.survey.url} className="font-semibold text-primary">{t("site.surveyOpen")}</ExternalLink>}
            </div>
          </PageSection>
        )}

        <PageSection id="more" title={t("more.title")}>
          <ul className={grid}>
            <li><LinkTile href="/services" title={t("more.services")} text={t("more.servicesText")} /></li>
            <li><LinkTile href="/legal" title={t("more.legal")} text={t("more.legalText")} /></li>
            <li><LinkTile href="/symbols" title={t("more.symbols")} text={t("more.symbolsText")} /></li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchTotal } from "@/components/misc/api";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, SeeAlso } from "@/components/misc/page-layout";
import { Pending } from "@/components/misc/pending";
import { ExternalLink } from "@/components/ui/external-link";
import { PageHeader } from "@/components/ui/page-header";
import { fetchSiteSettings } from "@/lib/api/site-settings";

/**
 * Адреса проверены вручную; где официальный адрес заказчик не подтвердил, href нет — показываем
 * «ссылка уточняется», а не предполагаемый адрес.
 */
const GROUPS: { id: string; links: { id: string; href?: string }[] }[] = [
  { id: "state", links: [{ id: "akorda", href: "https://www.akorda.kz" }, { id: "akimat", href: "https://www.gov.kz/memleket/entities/akimvko" }, { id: "department" }] },
  { id: "services", links: [{ id: "egov", href: "https://egov.kz" }, { id: "eotinish", href: "https://eotinish.kz" }, { id: "adilet", href: "https://adilet.zan.kz" }] },
  { id: "memory", links: [{ id: "veterans" }] },
  { id: "tools", links: [{ id: "converter" }] },
];
const COUNTS = [
  { id: "funds", path: "catalog/funds?per_page=1" },
  { id: "documents", path: "catalog/documents?per_page=1" },
  { id: "exhibitions", path: "exhibitions" },
] as const;

export const generateMetadata = pageMetadata("misc.links", "/links");

/** Полезные ссылки по назначению и малые блоки дополнения к ТЗ: статистика, рейтинг сайтов, опрос. */
export default async function LinksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.links");
  const [settings, ...totals] = await Promise.all([fetchSiteSettings(locale), ...COUNTS.map(({ path }) => fetchTotal(path))]);
  const counts = COUNTS.map(({ id }, index) => ({ id, total: totals[index] })).filter((count) => count.total !== null);
  const row = "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)]";

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageBody
        aside={
          <SeeAlso
            title={t("more.title")}
            items={[
              { href: "/services", label: t("more.services"), text: t("more.servicesText") },
              { href: "/legal", label: t("more.legal") },
              { href: "/symbols", label: t("more.symbols") },
            ]}
          />
        }
      >
        {GROUPS.map((group) => (
          <Block key={group.id} id={group.id} title={t(`groups.${group.id}`)}>
            <ul className="card divide-y px-5">
              {group.links.map(({ id, href }) => (
                <li key={id} className="py-3">
                  {href ? (
                    <ExternalLink href={href} className="font-medium">{t(`items.${id}.label`)}</ExternalLink>
                  ) : (
                    <p className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                      <span className="font-medium">{t(`items.${id}.label`)}</span>
                      <Pending>{t("urlPending")}</Pending>
                    </p>
                  )}
                  <p className="mt-0.5 text-sm text-muted-foreground">{t(`items.${id}.text`)}</p>
                </li>
              ))}
            </ul>
          </Block>
        ))}

        {settings && settings.useful_links.length > 0 && (
          <Block id="added" title={t("groups.added")}>
            <ul className="card divide-y px-5">
              {settings.useful_links.map((link) => (
                <li key={link.url} className="py-3"><ExternalLink href={link.url} className="font-medium">{link.title}</ExternalLink></li>
              ))}
            </ul>
          </Block>
        )}

        <Block id="site" title={t("site.title")} text={t("site.text")}>
          <dl className="card divide-y px-5">
            <div className={row}>
              <dt className="font-medium">{t("site.stats")}</dt>
              <dd>
                {counts.length > 0 ? (
                  <ul className="flex flex-wrap gap-x-8 gap-y-1">
                    {counts.map(({ id, total }) => (
                      <li key={id} className="font-semibold tabular-nums">{t(`site.counts.${id}`, { count: total! })}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">{t("site.statsMissing")}</span>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {settings?.counter.enabled ? t("site.visitors", { count: settings.counter.value }) : t("site.visitorsOff")}
                </p>
              </dd>
            </div>
            <div className={row}>
              <dt className="font-medium">{t("site.rating")}</dt>
              <dd className="text-muted-foreground">{t(settings?.widgets.rating ? "site.ratingOn" : "site.ratingOff")}</dd>
            </div>
            <div className={row}>
              <dt className="font-medium">{t("site.survey")}</dt>
              <dd>
                {settings?.survey.enabled ? (
                  <>
                    <p>{settings.survey.question}</p>
                    {settings.survey.url && <p className="mt-1"><ExternalLink href={settings.survey.url} className="text-primary underline underline-offset-[3px]">{t("site.surveyOpen")}</ExternalLink></p>}
                  </>
                ) : (
                  <span className="text-muted-foreground">{t("site.surveyOff")}</span>
                )}
                <p className="mt-1 text-sm text-muted-foreground">{t("site.surveyNote")}</p>
              </dd>
            </div>
          </dl>
        </Block>
      </PageBody>
    </>
  );
}

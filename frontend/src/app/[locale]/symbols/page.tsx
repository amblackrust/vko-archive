import { getTranslations, setRequestLocale } from "next-intl/server";
import { InfoStrip, PageSection, PageStack } from "@/components/misc/blocks";
import { pageMetadata } from "@/components/misc/metadata";
import { SourceCard } from "@/components/misc/source-card";
import { ExternalLink } from "@/components/ui/external-link";
import { PageHeader } from "@/components/ui/page-header";

// Официальные страницы о символах на сайте Президента (akorda.kz) и текст закона в «Әділет»; адреса проверены.
const AKORDA: Record<string, string> = { ru: "ru", kk: "kz", en: "en" };
const ADILET: Record<string, string> = { ru: "rus", kk: "kaz", en: "eng" };
const SYMBOLS = [
  { id: "flag", path: "kazakhstan_flag" },
  { id: "emblem", path: "kazakhstan_emblem" },
  { id: "anthem", path: "kazakhstan_anthem" },
] as const;

export const generateMetadata = pageMetadata("misc.symbols", "/symbols");

/** Государственные символы: три равные карточки с краткими сведениями по официальным источникам и ссылки на них. */
export default async function SymbolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.symbols");
  const akorda = `https://www.akorda.kz/${AKORDA[locale] ?? "ru"}/state_symbols`;
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageStack>
        <ul className="grid gap-4 lg:grid-cols-3">
          {SYMBOLS.map(({ id, path }) => (
            <li key={id} className="card row-span-4 grid grid-rows-subgrid gap-y-3 p-6 sm:p-8">
              <h2 className="text-2xl">{t(`${id}.title`)}</h2>
              <p>{t(`${id}.text`)}</p>
              <p className="border-t pt-3 text-[0.9375rem] text-muted-foreground">{t(`${id}.authors`)}</p>
              <p><ExternalLink href={`${akorda}/${path}`} className="font-semibold text-primary">{t(`${id}.link`)}</ExternalLink></p>
            </li>
          ))}
        </ul>

        <InfoStrip
          items={[
            { label: t("facts.law"), value: t("facts.lawValue") },
            { label: t("facts.day"), value: t("facts.dayValue") },
            { label: t("facts.adopted"), value: t("facts.adoptedValue") },
          ]}
        />

        <PageSection id="sources" title={t("sources.title")} text={t("sources.text")}>
          <ul className="grid gap-4 lg:auto-rows-fr lg:grid-cols-2">
            <li><SourceCard portal="akorda" href={`${akorda}/about_state_symbols`} title={t("sources.akorda")} /></li>
            <li><SourceCard portal="adilet" href={`https://adilet.zan.kz/${ADILET[locale] ?? "rus"}/docs/Z070000258_`} title={t("sources.law")} /></li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}
